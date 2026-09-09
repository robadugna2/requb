/**
 * Import script for "equb stetment 1.md" - CBE bank statement HTML tables
 * 
 * This parses the HTML table rows from the .md file, extracts CREDIT transactions only,
 * matches senders to RAT group members by bankAccountName, assigns deposits to the
 * correct cycle based on deposit date, and stores all relevant info including:
 * - FT number (bank reference)
 * - Narrative (transfer method - e.g. "done via Mobile")
 * - Deposit date (actual transfer date, NOT upload date)
 * - Sender name, amount, bank name
 * 
 * Duplicate prevention: Uses ftNumber uniqueness constraint
 * 
 * Usage: node scripts/import-equb-statement-1.js [--dry-run]
 */

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const GROUP_ID = 'cmqh5w5ft0004setfpb6z2jde'; // RAT group
const BANK_NAME = 'CBE';
const RECEIVER_ACCOUNT = '1000734617664';
const DRY_RUN = process.argv.includes('--dry-run');

// ─── HTML Parsing ───────────────────────────────────────────────────

function parseHtmlTables(html) {
  const transactions = [];
  
  // Match all table rows
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    
    // Skip header rows
    if (rowHtml.includes('>Date<') || rowHtml.includes('>Particulars<')) continue;
    
    // Skip "Balance C/F" rows (colspan)
    if (rowHtml.includes('colspan')) continue;
    
    // Extract all cell values
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Clean HTML entities and trim
      let val = cellMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#?\w+;/g, '')
        .replace(/<[^>]*>/g, '') // strip any nested tags
        .trim();
      cells.push(val);
    }
    
    if (cells.length < 8) continue;
    
    // Column mapping:
    // 0: Date, 1: Particulars, 2: Reference, 3: Narrative, 4: Sender/Receiver
    // 5: Value Date, 6: Debit, 7: Credit, 8: Balance
    const date = cells[0];
    const particulars = cells[1];
    const reference = cells[2];
    const narrative = cells[3];
    const sender = cells[4];
    const valueDate = cells[5];
    const debit = cells[6];
    const credit = cells[7];
    const balance = cells.length > 8 ? cells[8] : '';
    
    transactions.push({ date, particulars, reference, narrative, sender, valueDate, debit, credit, balance });
  }
  
  return transactions;
}

// ─── Amount Parsing ─────────────────────────────────────────────────

function parseAmount(amountStr) {
  if (!amountStr || amountStr === '.00' || amountStr === '00' || amountStr === '✓ 00' || amountStr === '✓.00') {
    return 0;
  }
  
  // Remove checkmarks and leading/trailing whitespace
  let cleaned = amountStr.replace(/✓/g, '').trim();
  
  // Handle negative amounts (debits)
  if (cleaned.startsWith('-')) return 0; // We skip debits
  
  // Determine if dots are used as thousand separators
  // Pattern: "20.400.00" means 20,400.00 (dots as thousands, last .00 is decimals)
  // Pattern: "61,200.00" means 61,200.00 (commas as thousands, .XX is decimals)
  
  // Count dots
  const dots = (cleaned.match(/\./g) || []).length;
  const commas = (cleaned.match(/,/g) || []).length;
  
  if (dots >= 2 && commas === 0) {
    // Dots are used as thousand separators, last .XX is decimal
    // "20.400.00" -> remove all dots except potentially last one for decimals
    // Actually in this format: "20.400.00" the last ".00" is the decimal part
    // So: split by '.', last element is decimal (always "00"), join the rest
    const parts = cleaned.split('.');
    const decimal = parts.pop(); // "00"
    const whole = parts.join(''); // "20400"
    cleaned = whole + '.' + decimal;
  } else if (commas >= 1) {
    // Commas are thousand separators: "61,200.00"
    cleaned = cleaned.replace(/,/g, '');
  }
  
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

// ─── Date Parsing ───────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Format: "DD MM YYYY" (e.g., "28 02 2026", "01 03 2026")
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  // Create date at midnight UTC
  return new Date(Date.UTC(year, month - 1, day));
}

// ─── FT Number Cleaning ─────────────────────────────────────────────

function cleanFtNumber(ft) {
  if (!ft) return null;
  
  // Remove unicode escape sequences
  let cleaned = ft.replace(/\\u[0-9a-fA-F]{4}/g, '');
  // Remove actual unicode characters that got decoded (é, etc.)
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');
  // Remove internal spaces
  cleaned = cleaned.replace(/\s+/g, '');
  // Trim
  cleaned = cleaned.trim();
  
  if (!cleaned || cleaned.length < 5) return null;
  return cleaned;
}

// ─── Narrative Extraction ───────────────────────────────────────────

function extractNarrative(particulars, narrative) {
  // Use the longer/more descriptive one
  const text = (narrative && narrative.length > (particulars || '').length) ? narrative : (particulars || '');
  
  if (!text) return null;
  
  // Expand common abbreviations for clarity
  let expanded = text;
  if (/done via Mo/i.test(expanded) || /via Mobil/i.test(expanded) || /via Mob/i.test(expanded)) {
    expanded = 'Transfer done via Mobile Banking';
  } else if (/^Transfer$/i.test(expanded)) {
    expanded = 'Direct Transfer';
  } else if (/done via/i.test(expanded)) {
    expanded = expanded; // Keep as-is if it already has detail
  }
  
  return expanded || null;
}

// ─── Known Sender Aliases (manually verified mappings) ──────────────
// Maps PDF sender names to member names for cases where fuzzy matching fails
const SENDER_ALIASES = {
  // Spaces removed in PDF
  'TEFETERNEGASHABAERIE': 'Tefetere Negash Abaerie',
  'KAHASASEGELE HAILE': 'Kahasse Asgele Haile',
  'KAHASASEGELEHAILE': 'Kahasse Asgele Haile',
  'TSEGAYFESEHAASFAW': 'Tsegaye Feseha Asfaw',
  'TSEGAYEFESEHAASFAW': 'Tsegaye Feseha Asfaw',
  'NEJATNASIRAVKERIM': 'Hamida Gosa',
  'NEJAT NASIR A/KERIM': 'Hamida Gosa',
  // Full names where DB has abbreviated
  'NEBIY TEKLIE G/YESUS': 'Nebyi Tekle',
  'NEBIY TEKLIE': 'Nebyi Tekle',
  'DANIEL MINWYELET MEHARI': 'Daniel Mnyelet',
  'GEREZIHARE NIGUSSE GEBRE': 'Gereziher Nguse',
  'GEREZIHARE NIGUSSE': 'Gereziher Nguse',
  // Joint account names (the first part identifies the member)
  'TESFALIDETEKLEZGHIH/MICHAEL&/AKLILUT/HAIMANOTH/MICHAEL': 'Tesfalidet Teklezghi H/Michael',
  'TESFALIDETTEKLEZGHIH/MICHAEL': 'Tesfalidet Teklezghi H/Michael',
  'TESFALIDETEKLEZGHIH/MICHAEL&/ AKLILUT/HAIMANOTH/MICHAEL': 'Tesfalidet Teklezghi H/Michael',
  'TESFALIDETEKLEZGHIH/MICHAEL&/AKILUT/HAIMANOTH/MICHAEL': 'Tesfalidet Teklezghi H/Michael',
  // External payers on behalf of members (verified from context)
  'MRS ASHENFECH CHAKA BEKELE': 'Urge',
  'MRS ASHENFEECH CHAKA BEKELE': 'Urge',
  'MRS ASHENEFECH CHAKA BEKELE': 'Urge',
  'DONAT FANTA ALARO': 'Dawit Gezaehagn',
  'DONATFANTALARO': 'Dawit Gezaehagn',
  'MRS ALEMITUBEKELE WORKU': 'Frehiwet Nega Haftie',
  'MRS ALEMITU BEKELE WORKU': 'Frehiwet Nega Haftie',
  'MR ADDIS TESFA MEKONEN': 'Adane Abeje Ayalew',
  'TEWABE GETA BIZUNEH': 'Sifen Tokoma',
  'TEWABE GETA BIZUNEH \\beta': 'Sifen Tokoma',
  'Mr Tekile Kebede Teshome': 'Meseret Demelash',
  'WALELIGN ASSEFA DEMSIE': 'Hailemariam Munie',
  'WALELIGN\nASSEFA DEMSIE': 'Hailemariam Munie',
  'TEKA HAILU WELDEYES': 'Tesfay Alem Kahsay',
};

// ─── Member Matching ────────────────────────────────────────────────

function normalize(str) {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/^(MR|MRS|REV|DR)\s+/i, '')
    .replace(/[^A-Z]/g, '');
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function matchMember(senderName, members) {
  if (!senderName) return null;
  
  // Check manual aliases first (highest priority, no guessing)
  const aliasKey = Object.keys(SENDER_ALIASES).find(key => {
    const senderClean = senderName.replace(/\s+/g, ' ').trim();
    return senderClean === key || normalize(senderClean) === normalize(key);
  });
  if (aliasKey) {
    const targetName = SENDER_ALIASES[aliasKey];
    const member = members.find(m => m.name === targetName);
    if (member) return member;
  }
  
  const senderNorm = normalize(senderName);
  if (!senderNorm) return null;
  
  // Try exact normalized match against bankAccountName
  for (const m of members) {
    if (normalize(m.bankAccountName) === senderNorm) return m;
  }
  
  // Try contains match (one contains the other)
  for (const m of members) {
    const bankNorm = normalize(m.bankAccountName);
    if (!bankNorm) continue;
    if (senderNorm.includes(bankNorm) || bankNorm.includes(senderNorm)) return m;
  }
  
  // Try Levenshtein distance ≤ 3 against bankAccountName
  for (const m of members) {
    const bankNorm = normalize(m.bankAccountName);
    if (!bankNorm) continue;
    if (Math.abs(senderNorm.length - bankNorm.length) <= 3) {
      const dist = levenshtein(senderNorm, bankNorm);
      if (dist <= 3) return m;
    }
  }
  
  // Try word overlap (at least 2 significant words in common)
  const senderWords = senderName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  for (const m of members) {
    if (!m.bankAccountName) continue;
    const bankWords = m.bankAccountName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const common = senderWords.filter(w => bankWords.some(bw => bw === w || bw.includes(w) || w.includes(bw)));
    if (common.length >= 2) return m;
  }
  
  // Try matching against member name (not just bankAccountName)
  for (const m of members) {
    const nameNorm = normalize(m.name);
    if (senderNorm.includes(nameNorm) || nameNorm.includes(senderNorm)) return m;
  }
  
  // Levenshtein against member name
  for (const m of members) {
    const nameNorm = normalize(m.name);
    if (!nameNorm) continue;
    if (Math.abs(senderNorm.length - nameNorm.length) <= 3) {
      const dist = levenshtein(senderNorm, nameNorm);
      if (dist <= 3) return m;
    }
  }
  
  // Word overlap against name
  for (const m of members) {
    const nameWords = m.name.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const common = senderWords.filter(w => nameWords.some(nw => nw === w || nw.includes(w) || w.includes(nw)));
    if (common.length >= 2) return m;
  }
  
  return null;
}

// ─── Cycle Assignment ───────────────────────────────────────────────

function findCycleForDate(date, cycles) {
  if (!date) return null;
  
  for (const cycle of cycles) {
    const start = new Date(cycle.startDate);
    const end = new Date(cycle.endDate);
    // Set to start/end of day for comparison
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    
    if (date >= start && date <= end) return cycle;
  }
  
  // If no exact match, find closest cycle (deposit might be 1-2 days before/after)
  let bestCycle = null;
  let minDist = Infinity;
  
  for (const cycle of cycles) {
    const start = new Date(cycle.startDate);
    const end = new Date(cycle.endDate);
    const distToStart = Math.abs(date - start);
    const distToEnd = Math.abs(date - end);
    const dist = Math.min(distToStart, distToEnd);
    
    if (dist < minDist && dist <= 3 * 24 * 60 * 60 * 1000) { // within 3 days
      minDist = dist;
      bestCycle = cycle;
    }
  }
  
  return bestCycle;
}

// ─── Main Import ────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  IMPORT: equb stetment 1.md → RAT Group Deposits`);
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no database changes)' : '💾 LIVE (inserting deposits)'}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  // 1. Read the file
  const filePath = 'C:/Users/Abrsh-1/Downloads/equb stetment 1.md';
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`📄 File loaded: ${(content.length / 1024).toFixed(1)} KB`);
  
  // 2. Parse HTML tables
  const allTransactions = parseHtmlTables(content);
  console.log(`📊 Total rows parsed: ${allTransactions.length}`);
  
  // 3. Filter to CREDIT transactions only (skip debits and zero-amounts)
  const creditTransactions = allTransactions.filter(tx => {
    const creditAmount = parseAmount(tx.credit);
    const debitAmount = parseAmount(tx.debit);
    
    // Skip if debit has a real negative value (withdrawal)
    if (tx.debit && tx.debit.includes('-') && !tx.debit.includes('✓')) return false;
    
    // Skip if credit is zero or negligible
    if (creditAmount <= 0) return false;
    
    // Skip if this looks like a debit transaction (debit has actual amount)
    if (debitAmount > 0 && creditAmount === 0) return false;
    
    return true;
  });
  console.log(`💰 Credit transactions: ${creditTransactions.length}`);
  
  // 4. Load members
  const group = await prisma.equbGroup.findUnique({
    where: { id: GROUP_ID },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, bankAccountName: true } } }
      }
    }
  });
  
  const members = group.memberships.map(m => ({
    userId: m.user.id,
    name: m.user.name,
    bankAccountName: m.user.bankAccountName,
  }));
  console.log(`👥 Members loaded: ${members.length}`);
  
  // 5. Load cycles
  const cycles = await prisma.cycle.findMany({
    where: { groupId: GROUP_ID },
    orderBy: { cycleNumber: 'asc' },
  });
  console.log(`🔄 Cycles loaded: ${cycles.length}`);
  
  // 6. Process each credit transaction
  const results = {
    created: 0,
    duplicates: 0,
    unmatched: [],
    noCycle: [],
    noFt: [],
    errors: [],
  };
  
  const depositsToCreate = [];
  
  for (const tx of creditTransactions) {
    const depositDate = parseDate(tx.date);
    const amount = parseAmount(tx.credit);
    const ftNumber = cleanFtNumber(tx.reference);
    const narrative = extractNarrative(tx.particulars, tx.narrative);
    const sender = tx.sender;
    
    // Skip very small amounts (likely fees or rounding)
    if (amount < 100) continue;
    
    // Validate FT number
    if (!ftNumber) {
      results.noFt.push({ sender, date: tx.date, amount });
      continue;
    }
    
    // Match member
    const member = matchMember(sender, members);
    if (!member) {
      results.unmatched.push({ sender, date: tx.date, amount, ft: ftNumber });
      continue;
    }
    
    // Find cycle by deposit date
    if (!depositDate) {
      results.errors.push({ reason: 'Invalid date', sender, date: tx.date, ft: ftNumber });
      continue;
    }
    
    const cycle = findCycleForDate(depositDate, cycles);
    if (!cycle) {
      results.noCycle.push({ sender, date: tx.date, amount, ft: ftNumber, depositDate });
      continue;
    }
    
    depositsToCreate.push({
      cycleId: cycle.id,
      cycleNumber: cycle.cycleNumber,
      userId: member.userId,
      memberName: member.name,
      imageUrl: 'bank-statement-import',
      ftNumber,
      amount,
      bankName: BANK_NAME,
      depositDate,
      senderName: sender,
      receiverAccount: RECEIVER_ACCOUNT,
      narrative,
      verificationStatus: 'VERIFIED',
      confidence: 1.0,
    });
  }
  
  // Sort by cycle number then deposit date for consistent ordering
  depositsToCreate.sort((a, b) => {
    if (a.cycleNumber !== b.cycleNumber) return a.cycleNumber - b.cycleNumber;
    return a.depositDate - b.depositDate;
  });
  
  console.log(`\n📋 Deposits to insert: ${depositsToCreate.length}`);
  console.log(`   Unmatched senders: ${results.unmatched.length}`);
  console.log(`   No FT number: ${results.noFt.length}`);
  console.log(`   No matching cycle: ${results.noCycle.length}`);
  console.log(`   Errors: ${results.errors.length}`);
  
  // Print unmatched senders for review
  if (results.unmatched.length > 0) {
    console.log(`\n⚠️  Unmatched senders:`);
    results.unmatched.forEach(u => console.log(`   - "${u.sender}" (${u.date}, ${u.amount} ETB, ${u.ft})`));
  }
  
  if (results.noCycle.length > 0) {
    console.log(`\n⚠️  No cycle found for date:`);
    results.noCycle.forEach(u => console.log(`   - "${u.sender}" (${u.date}, ${u.amount} ETB, ${u.ft})`));
  }
  
  // 7. Insert deposits (if not dry run)
  if (!DRY_RUN) {
    console.log(`\n💾 Inserting deposits...`);
    
    for (const dep of depositsToCreate) {
      try {
        await prisma.deposit.create({
          data: {
            cycleId: dep.cycleId,
            userId: dep.userId,
            imageUrl: dep.imageUrl,
            ftNumber: dep.ftNumber,
            amount: dep.amount,
            bankName: dep.bankName,
            depositDate: dep.depositDate,
            senderName: dep.senderName,
            receiverAccount: dep.receiverAccount,
            narrative: dep.narrative,
            verificationStatus: dep.verificationStatus,
            confidence: dep.confidence,
          },
        });
        results.created++;
      } catch (err) {
        if (err.code === 'P2002') {
          // Unique constraint violation (FT number already exists)
          results.duplicates++;
        } else {
          results.errors.push({ reason: err.message, ft: dep.ftNumber, member: dep.memberName });
        }
      }
    }
    
    console.log(`\n✅ Results:`);
    console.log(`   Created: ${results.created}`);
    console.log(`   Duplicates (skipped): ${results.duplicates}`);
    console.log(`   Errors: ${results.errors.length}`);
  } else {
    // Dry run - show what would be inserted, sorted by cycle
    console.log(`\n📊 Preview (sorted by cycle):`);
    let currentCycle = 0;
    for (const dep of depositsToCreate) {
      if (dep.cycleNumber !== currentCycle) {
        currentCycle = dep.cycleNumber;
        console.log(`\n  ── Cycle ${currentCycle} ──`);
      }
      console.log(`   ${dep.depositDate.toISOString().split('T')[0]} | ${dep.memberName.padEnd(30)} | ${String(dep.amount).padStart(8)} ETB | ${dep.ftNumber} | ${dep.narrative || ''}`);
    }
  }
  
  // Print final summary with cycle breakdown
  if (!DRY_RUN && results.created > 0) {
    console.log(`\n📊 Deposits by cycle:`);
    const cycleCount = {};
    depositsToCreate.forEach(d => {
      if (!cycleCount[d.cycleNumber]) cycleCount[d.cycleNumber] = 0;
      cycleCount[d.cycleNumber]++;
    });
    Object.keys(cycleCount).sort((a, b) => Number(a) - Number(b)).forEach(c => {
      console.log(`   Cycle ${c}: ${cycleCount[c]} deposits`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(e => console.log(`   - ${e.reason} (${e.ft || e.sender || ''})`));
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  DONE`);
  console.log(`${'═'.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
