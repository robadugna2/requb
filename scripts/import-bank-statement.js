const fs = require('fs');
const pdf = require('pdf-parse');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const GROUP_ID = 'cmqh5w5ft0004setfpb6z2jde';
const PDF_PATH = 'C:/Users/Abrsh-1/Downloads/Telegram Desktop/anteneh equb CBE.AC.STMT.MOD.RP (1).pdf';

// Weekly cycle definitions based on the bank statement dates (24 Apr - 10 Jun 2026)
const CYCLES = [
  { number: 24, start: '2026-04-21', end: '2026-04-27' },
  { number: 25, start: '2026-04-28', end: '2026-05-04' },
  { number: 26, start: '2026-05-05', end: '2026-05-11' },
  { number: 27, start: '2026-05-12', end: '2026-05-18' },
  { number: 28, start: '2026-05-19', end: '2026-05-25' },
  { number: 29, start: '2026-05-26', end: '2026-06-01' },
  { number: 30, start: '2026-06-02', end: '2026-06-09' },
];

// Known bank account names mapped to member names for disambiguation
// Some members share the same bank account name (they deposit through someone else's account)
// We disambiguate using amount (shares * ~20,400 per share)
const BANK_NAME_TO_MEMBER_PRIORITY = {
  'GETACHEW TAZERA WELALIGN': [
    { name: 'Dawit Gezaehagn', shares: 2 },       // 2 shares = 40,000-40,800
    { name: 'Getachew Tazera Welalign', shares: 1 } // 1 share = 20,000-20,400
  ],
  'MRS MANALESH GEZAHEGN BIREGA': [
    { name: 'Hailemariam Munie', shares: 2 },       // 2 shares = 40,000-45,000
    { name: 'Manalesh Gezahegn Birega', shares: 2 } // 2 shares = 40,000-45,000
  ],
};

// Special sender names that need manual mapping
const SPECIAL_SENDERS = {
  'MR ADDIS TESFA MEKONEN': 'Dereje Gashaw',    // Dereje (Internal/cash) pays through this account
  'ESRAEL GEZEHAGN BIREGA': 'Manalesh Gezahegn Birega', // Family member paying for Manalesh
  'Mr Tekile Kebede Teshome': 'Sifen Tokoma',   // Sifen (Internal) pays through this account
};

function parseDateFromText(dateStr) {
  // Format: "DD MM YYYY" e.g., "24 04 2026"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
  }
  return null;
}

function getCycleForDate(date) {
  for (const cycle of CYCLES) {
    const start = new Date(cycle.start + 'T00:00:00.000Z');
    const end = new Date(cycle.end + 'T23:59:59.999Z');
    if (date >= start && date <= end) {
      return cycle.number;
    }
  }
  // If date is slightly outside range, find closest cycle
  const dateMs = date.getTime();
  let closest = CYCLES[0];
  let minDiff = Infinity;
  for (const cycle of CYCLES) {
    const mid = new Date(cycle.start + 'T00:00:00.000Z').getTime() + 3.5 * 24 * 60 * 60 * 1000;
    const diff = Math.abs(dateMs - mid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = cycle;
    }
  }
  return closest.number;
}

function extractFTNumber(text) {
  // FT numbers are like FT26114YNG5, FT2611566TLP, FT26116DFWK, etc.
  const match = text.match(/FT\d{5}[A-Z0-9]+/);
  return match ? match[0] : null;
}

function parseTransactions(fullText) {
  const transactions = [];
  
  // Split text into pages for easier processing
  const pages = fullText.split(/Page :\d+\/\d+\s*\n\s*COMMERCIAL BANK OF ETHIOPIA/);
  
  for (const pageText of pages) {
    // Find all FT numbers on this page
    const ftPattern = /FT\d{5}[A-Z0-9]+/g;
    let ftMatch;
    const ftPositions = [];
    
    while ((ftMatch = ftPattern.exec(pageText)) !== null) {
      ftPositions.push({ ft: ftMatch[0], pos: ftMatch.index });
    }
    
    // For each FT number, look backwards and forwards to extract transaction data
    for (let i = 0; i < ftPositions.length; i++) {
      const ftInfo = ftPositions[i];
      
      // Get the context around this FT number
      const startPos = i > 0 ? ftPositions[i - 1].pos + ftPositions[i - 1].ft.length : 0;
      const endPos = i < ftPositions.length - 1 ? ftPositions[i + 1].pos : pageText.length;
      const context = pageText.substring(startPos, endPos);
      
      // Extract credit amount - look for pattern: NUMBER,NUMBER.00 followed by .00 (zero debit) or preceding balance
      // Credit transactions have a positive credit amount and 0.00 debit
      const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})(\.00)(\d{2}\s+\d{2}\s+\d{4})/;
      
      // Simpler approach: look for the date pattern near the FT number
      const datePattern = /(\d{2}\s+\d{2}\s+\d{4})/g;
      let dateMatch;
      const dates = [];
      const contextBeforeFT = pageText.substring(Math.max(0, ftInfo.pos - 500), ftInfo.pos);
      
      while ((dateMatch = datePattern.exec(contextBeforeFT)) !== null) {
        dates.push(dateMatch[1]);
      }
      
      // The last date before FT is the transaction date
      const txDate = dates.length > 0 ? dates[dates.length - 1] : null;
      
      // Look for credit amount: pattern is BALANCE CREDIT .00 DATE
      // Credit amounts are numbers like 55,000.00, 61,200.00, 10,000.00 etc.
      // They appear between the previous balance and .00 (zero debit)
      const creditPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})\s*(\d{1,3}(?:,\d{3})*\.\d{2})\s*\.00\s*\d{2}\s+\d{2}\s+\d{4}/;
      const creditMatch = contextBeforeFT.match(creditPattern);
      
      let creditAmount = null;
      if (creditMatch) {
        creditAmount = parseFloat(creditMatch[2].replace(/,/g, ''));
      }
      
      // Check if this is a debit (withdrawal) - skip these
      const debitPattern = /\.00\s*-?\d{1,3}(?:,\d{3})*\.\d{2}\s*\d{2}\s+\d{2}\s+\d{4}/;
      const isDebit = debitPattern.test(contextBeforeFT.slice(-200));
      
      // Extract sender name - appears after date and before narrative
      // Look for multi-word names in the context
      const senderContext = contextBeforeFT.slice(-300);
      
      if (ftInfo.ft && txDate && creditAmount && creditAmount > 0 && !isDebit) {
        transactions.push({
          ftNumber: ftInfo.ft,
          date: txDate,
          amount: creditAmount,
          rawContext: senderContext.slice(-150),
        });
      }
    }
  }
  
  return transactions;
}

// More reliable approach: parse transactions from the structured text
function parseTransactionsV2(fullText) {
  const transactions = [];
  
  // Each transaction in the bank statement follows this pattern:
  // BALANCE,CREDIT,.00,DATE,SENDER,NARRATIVE,FT_NUMBER,...,DATE
  // OR for debits:
  // BALANCE,.00,-AMOUNT,DATE,...
  
  // Strategy: Find each line that contains both a credit amount and an FT number
  // Split by FT numbers and work with each segment
  
  const lines = fullText.split('\n');
  let currentTx = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect a new transaction by finding a balance line
    // Balance lines look like: "581,942.0055,000.00.0024 04 2026"
    // or "1,114,942.0061,200.00.0026 04 2026"
    const txStartPattern = /^(\d{1,3}(?:,\d{3})*\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})(\.00)(\d{2}\s+\d{2}\s+\d{4})$/;
    const txStartMatch = line.match(txStartPattern);
    
    if (txStartMatch) {
      // This is a credit transaction (debit is .00)
      if (currentTx && currentTx.ftNumber) {
        transactions.push(currentTx);
      }
      currentTx = {
        balance: parseFloat(txStartMatch[1].replace(/,/g, '')),
        amount: parseFloat(txStartMatch[2].replace(/,/g, '')),
        date: txStartMatch[4],
        senderLines: [],
        narrative: '',
        ftNumber: null,
      };
      continue;
    }
    
    // Check for debit transaction: BALANCE,.00,-AMOUNT,DATE
    const debitPattern = /^(\d{1,3}(?:,\d{3})*\.\d{2})(\.00)(-?\d{1,3}(?:,\d{3})*\.\d{2})(\d{2}\s+\d{2}\s+\d{4})$/;
    const debitMatch = line.match(debitPattern);
    if (debitMatch) {
      // Save previous transaction
      if (currentTx && currentTx.ftNumber) {
        transactions.push(currentTx);
      }
      // Mark this as a debit (we'll skip it)
      currentTx = { isDebit: true, senderLines: [] };
      continue;
    }
    
    // Check for FT number
    const ftMatch = line.match(/(FT\d{5}[A-Z0-9]+)/);
    if (ftMatch && currentTx) {
      currentTx.ftNumber = ftMatch[1];
      continue;
    }
    
    // Accumulate sender/narrative lines
    if (currentTx && !currentTx.isDebit && !currentTx.ftNumber && line.length > 0) {
      // Skip header/footer lines
      if (line.includes('Balance') || line.includes('COMMERCIAL BANK') || 
          line.includes('Account Statement') || line.includes('TULU DIMTU') ||
          line.includes('Balances') || line.includes('Statement of') ||
          line.includes('Account :') || line.includes('Currency') ||
          line.includes('Account Type') || line.includes('Woreda') ||
          line.includes('Addis Ababa') || line.includes('Akaki Kality') ||
          line.includes('Miss Frehiwet') || line.includes('1051309832') ||
          line.includes('FEREY') || line.includes('Wadiah') ||
          line.includes('Sender/') || line.includes('Narrative') ||
          line.includes('Reference') || line.includes('Particulars') ||
          line.includes('ET') || line.includes('Please examine')) {
        continue;
      }
      currentTx.senderLines.push(line);
    }
  }
  
  // Don't forget the last transaction
  if (currentTx && currentTx.ftNumber && !currentTx.isDebit) {
    transactions.push(currentTx);
  }
  
  // Filter out debit transactions and clean up
  return transactions.filter(tx => !tx.isDebit && tx.amount > 0).map(tx => {
    // The first lines of senderLines are typically the sender name
    const sender = tx.senderLines.filter(l => 
      !l.includes('done via') && !l.includes('Transfer') && 
      !l.includes('ekub') && !l.includes('Pay') && !l.includes('MB ') &&
      !l.includes('Settlement') && !l.includes('\\') &&
      !l.includes('CBETETAA') && !l.includes('251') &&
      l.length > 1
    ).join(' ').trim();
    
    return {
      ftNumber: tx.ftNumber,
      amount: tx.amount,
      date: tx.date,
      senderName: sender || tx.senderLines.join(' ').trim(),
      narrative: tx.senderLines.join(' '),
    };
  });
}

// Final approach: manually parse from the known PDF text structure
// Each credit entry shows: NEW_BALANCE + CREDIT_AMOUNT + .00 + DATE on one joined line
// followed by sender name, narrative, and FT number
function parseFromRawText(text) {
  const transactions = [];
  
  // Match credit entries: balance followed by credit amount followed by .00 followed by date
  // Pattern in the raw text: "581,942.0055,000.00.0024 04 2026"
  // which means: balance=581,942.00, credit=55,000.00, debit=.00 (0), date=24 04 2026
  const creditPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})(\.00)(\d{2} \d{2} \d{4})/g;
  
  // Also match debit entries to skip them: balance + .00 + -amount + date
  const debitPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})(\.00)(-\d{1,3}(?:,\d{3})*\.\d{2})(\d{2} \d{2} \d{4})/g;
  
  // Find all credit matches with their positions
  let match;
  const creditMatches = [];
  while ((match = creditPattern.exec(text)) !== null) {
    creditMatches.push({
      pos: match.index,
      endPos: match.index + match[0].length,
      balance: match[1],
      amount: parseFloat(match[2].replace(/,/g, '')),
      date: match[4],
    });
  }
  
  // Find all debit matches to exclude
  const debitPositions = new Set();
  while ((match = debitPattern.exec(text)) !== null) {
    debitPositions.add(match.index);
  }
  
  // Filter out entries that are actually debits or Balance B/F lines
  const validCredits = creditMatches.filter(c => {
    // Skip if amount is 0 or matches a debit position
    if (c.amount === 0) return false;
    if (debitPositions.has(c.pos)) return false;
    // Skip opening balance line
    const before = text.substring(Math.max(0, c.pos - 30), c.pos);
    if (before.includes('Opening Balance') || before.includes('Balance B/F')) return false;
    return true;
  });
  
  // For each credit entry, find the FT number and sender that comes after it
  for (let i = 0; i < validCredits.length; i++) {
    const credit = validCredits[i];
    const nextPos = i < validCredits.length - 1 ? validCredits[i + 1].pos : credit.endPos + 1000;
    const afterText = text.substring(credit.endPos, Math.min(nextPos, credit.endPos + 500));
    
    // Find FT number in the text after this credit entry
    const ftMatch = afterText.match(/FT\d{5}[A-Z0-9]+/);
    if (!ftMatch) continue;
    
    // Extract sender name: text between date and FT number, filtering known patterns
    const beforeFT = afterText.substring(0, afterText.indexOf(ftMatch[0]));
    
    // Clean up sender - remove narratives, branch codes, and date repetitions
    const senderText = beforeFT
      .replace(/\n/g, ' ')
      .replace(/\d{2} \d{2} \d{4}/g, '')  // Remove dates
      .replace(/\\[A-Z]+/g, '')  // Remove branch codes like \ART, \KDM
      .replace(/done via.*/i, '')
      .replace(/MB Transfer.*/i, '')
      .replace(/Transfer.*/i, '')
      .replace(/Pay.*$/i, '')
      .replace(/ekub.*$/i, '')
      .replace(/for Equb.*$/i, '')
      .replace(/Paying.*$/i, '')
      .replace(/yes.*$/i, '')
      .replace(/xxxxx.*$/i, '')
      .replace(/tefetere.*$/i, '')
      .replace(/likub.*$/i, '')
      .replace(/eukub.*$/i, '')
      .replace(/equb.*$/i, '')
      .replace(/week.*$/i, '')
      .replace(/\d+\s*$/i, '')
      .replace(/[szk]\s*$/i, '')  // Single letter narratives like "z", "s", "k"
      .replace(/Settlement.*/i, '')
      .replace(/CBETETAA.*/i, '')
      .replace(/251\d+/g, '')
      .replace(/&\/.*$/i, '')  // Remove joint account markers
      .replace(/\u0002/g, '')
      .trim();
    
    // Clean up multi-spaces
    const cleanSender = senderText.replace(/\s+/g, ' ').trim();
    
    if (cleanSender.length < 2) continue;
    
    // Skip inter-bank transfers and TeleBirr settlements that aren't member deposits
    if (cleanSender.includes('Inter Bank') || cleanSender.includes('TeleBirr')) continue;
    
    transactions.push({
      ftNumber: ftMatch[0],
      amount: credit.amount,
      date: credit.date,
      senderName: cleanSender,
    });
  }
  
  return transactions;
}

async function matchSenderToMember(senderName, amount, members) {
  // Normalize for comparison
  const normalizedSender = senderName.toUpperCase().replace(/\s+/g, ' ').trim();
  
  // Check special senders first
  for (const [specialName, memberName] of Object.entries(SPECIAL_SENDERS)) {
    if (normalizedSender.includes(specialName.toUpperCase())) {
      const member = members.find(m => m.user.name === memberName);
      if (member) return member;
    }
  }
  
  // Try exact match on bankAccountName
  const exactMatches = members.filter(m => {
    if (!m.user.bankAccountName) return false;
    const bankNorm = m.user.bankAccountName.toUpperCase().replace(/\s+/g, ' ').trim();
    return normalizedSender.includes(bankNorm) || bankNorm.includes(normalizedSender);
  });
  
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  
  if (exactMatches.length > 1) {
    // Disambiguate by amount - find the member whose expected contribution matches
    // Expected contribution per share per cycle ≈ 20,400 (20,000 + 400 admin fee)
    const CONTRIBUTION_PER_SHARE = 20400;
    const TOLERANCE = 1000; // Allow some tolerance
    
    for (const m of exactMatches) {
      const expected = m.shares * CONTRIBUTION_PER_SHARE;
      if (Math.abs(amount - expected) < TOLERANCE) {
        return m;
      }
      // Also check multiples (paying for multiple cycles)
      for (let mult = 2; mult <= 4; mult++) {
        if (Math.abs(amount - expected * mult) < TOLERANCE) {
          return m;
        }
      }
    }
    // If still ambiguous, return first match
    return exactMatches[0];
  }
  
  // Try partial/fuzzy match on bankAccountName
  const partialMatches = members.filter(m => {
    if (!m.user.bankAccountName) return false;
    const bankNorm = m.user.bankAccountName.toUpperCase().replace(/\s+/g, ' ').trim();
    const bankWords = bankNorm.split(' ');
    const senderWords = normalizedSender.split(' ');
    // Match if at least 2 words overlap
    const overlap = bankWords.filter(w => senderWords.includes(w) && w.length > 2);
    return overlap.length >= 2;
  });
  
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }
  if (partialMatches.length > 1) {
    // Disambiguate by amount
    const CONTRIBUTION_PER_SHARE = 20400;
    for (const m of partialMatches) {
      const expected = m.shares * CONTRIBUTION_PER_SHARE;
      if (Math.abs(amount - expected) < 1000) return m;
    }
    return partialMatches[0];
  }
  
  // Try matching by member name directly
  const nameMatches = members.filter(m => {
    const nameNorm = m.user.name.toUpperCase().replace(/\s+/g, ' ').trim();
    const nameWords = nameNorm.split(' ');
    const senderWords = normalizedSender.split(' ');
    const overlap = nameWords.filter(w => senderWords.includes(w) && w.length > 2);
    return overlap.length >= 2;
  });
  
  if (nameMatches.length >= 1) {
    return nameMatches[0];
  }
  
  return null; // Unmatched
}

async function main() {
  console.log('📄 Parsing bank statement PDF...\n');
  
  // 1. Read and parse PDF
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const pdfData = await pdf(dataBuffer);
  const fullText = pdfData.text;
  
  console.log(`  Pages: ${pdfData.numpages}`);
  console.log(`  Text length: ${fullText.length} chars\n`);
  
  // 2. Parse transactions
  const transactions = parseFromRawText(fullText);
  console.log(`📊 Found ${transactions.length} credit transactions\n`);
  
  // 3. Get group and members
  const group = await prisma.equbGroup.findUnique({
    where: { id: GROUP_ID },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, phone: true, bankAccountName: true } }
        }
      }
    }
  });
  
  if (!group) {
    throw new Error(`Group ${GROUP_ID} not found`);
  }
  console.log(`✅ Group: ${group.name} (${group.memberships.length} members)\n`);
  
  const members = group.memberships;
  
  // 4. Create cycles if they don't exist
  console.log('🔄 Creating/updating cycles...');
  const cycleMap = {}; // cycleNumber -> cycleId
  
  for (const cycleDef of CYCLES) {
    const existing = await prisma.cycle.findUnique({
      where: { groupId_cycleNumber: { groupId: GROUP_ID, cycleNumber: cycleDef.number } }
    });
    
    if (existing) {
      cycleMap[cycleDef.number] = existing.id;
      console.log(`  Cycle ${cycleDef.number}: exists (${existing.id})`);
    } else {
      const created = await prisma.cycle.create({
        data: {
          groupId: GROUP_ID,
          cycleNumber: cycleDef.number,
          startDate: new Date(cycleDef.start + 'T00:00:00.000Z'),
          endDate: new Date(cycleDef.end + 'T23:59:59.999Z'),
          status: 'COMPLETED',
        }
      });
      cycleMap[cycleDef.number] = created.id;
      console.log(`  Cycle ${cycleDef.number}: created (${created.id})`);
    }
  }
  console.log('');
  
  // 5. Match transactions to members and create deposits
  console.log('💰 Processing deposits...\n');
  
  let depositsCreated = 0;
  let depositsSkipped = 0;
  let unmatchedTx = [];
  let duplicates = 0;
  
  for (const tx of transactions) {
    // Skip invalid transactions
    if (!tx.ftNumber || !tx.amount || !tx.date) {
      depositsSkipped++;
      continue;
    }
    
    // Parse date and get cycle
    const txDate = parseDateFromText(tx.date);
    if (!txDate) {
      console.log(`  ⚠️  Invalid date: ${tx.date} for FT ${tx.ftNumber}`);
      depositsSkipped++;
      continue;
    }
    
    const cycleNumber = getCycleForDate(txDate);
    const cycleId = cycleMap[cycleNumber];
    if (!cycleId) {
      console.log(`  ⚠️  No cycle for date ${tx.date} (cycle ${cycleNumber}) - FT ${tx.ftNumber}`);
      depositsSkipped++;
      continue;
    }
    
    // Match sender to member
    const member = await matchSenderToMember(tx.senderName, tx.amount, members);
    if (!member) {
      unmatchedTx.push({ ft: tx.ftNumber, sender: tx.senderName, amount: tx.amount, date: tx.date });
      continue;
    }
    
    // Check for duplicate FT number
    const existing = await prisma.deposit.findUnique({
      where: { ftNumber: tx.ftNumber }
    });
    if (existing) {
      duplicates++;
      continue;
    }
    
    // Create deposit
    try {
      await prisma.deposit.create({
        data: {
          cycleId: cycleId,
          userId: member.user.id,
          imageUrl: 'bank-statement-import',
          ftNumber: tx.ftNumber,
          amount: tx.amount,
          bankName: 'CBE',
          depositDate: txDate,
          senderName: tx.senderName,
          receiverAccount: '1000734617664',
          verificationStatus: 'VERIFIED',
          confidence: 1.0,
        }
      });
      depositsCreated++;
      console.log(`  ✅ [${tx.date}] ${tx.senderName} → ${member.user.name} — ${tx.amount.toLocaleString()} ETB (${tx.ftNumber}) [Cycle ${cycleNumber}]`);
    } catch (err) {
      console.log(`  ❌ Error creating deposit: ${err.message} (FT: ${tx.ftNumber})`);
      depositsSkipped++;
    }
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Import Summary:');
  console.log(`   Transactions found:   ${transactions.length}`);
  console.log(`   Deposits created:     ${depositsCreated}`);
  console.log(`   Duplicates skipped:   ${duplicates}`);
  console.log(`   Errors/skipped:       ${depositsSkipped}`);
  console.log(`   Unmatched senders:    ${unmatchedTx.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (unmatchedTx.length > 0) {
    console.log('\n⚠️  Unmatched transactions (could not match sender to a member):');
    unmatchedTx.forEach(tx => {
      console.log(`   - [${tx.date}] "${tx.sender}" — ${tx.amount.toLocaleString()} ETB (${tx.ft})`);
    });
  }
  
  console.log('\n✅ Done!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Import failed:', e.message);
    console.error(e.stack);
    await prisma.$disconnect();
    process.exit(1);
  });
