const fs = require('fs');
const pdf = require('pdf-parse');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const GROUP_ID = 'cmqh5w5ft0004setfpb6z2jde';
const PDF_PATH = 'C:/Users/Abrsh-1/Downloads/KAZA EUQUB (4).pdf';

// Branch code → member mapping (built from known data)
// Where a branch is shared, we disambiguate by amount (shares * ~20,000-20,400)
const BRANCH_TO_MEMBER = {
  'NSM': [{ name: 'Abdelfetah Riedwan', shares: 1 }],
  'ART': [{ name: 'Abel Birhane Faye', shares: 3 }],
  'GMB': [{ name: 'Abraham Zerezgi Wmicaiel', shares: 0.25 }],
  'BOM': [{ name: 'Elias Abebe W/Michael', shares: 0.5 }],
  'FHU': [{ name: 'Ashenafi Yohannis Mehari', shares: 1 }],
  'FUA': [{ name: 'Bilal Bahru Redi', shares: 1 }],
  'SUM': [{ name: 'Daniel Mnyelet', shares: 1 }],
  'ZAN': [{ name: 'Dejen Alem Kahsay', shares: 0.25 }, { name: 'Gereziher Nguse', shares: 0.25 }],
  'AKA': [{ name: 'Edilu Sema Zebere', shares: 0.5 }, { name: 'Dawit Gezaehagn', shares: 2 }],
  'ADM': [{ name: 'Ismael Mohammed Idris', shares: 1 }, { name: 'Hayelom Yohanes Mahari', shares: 1 }],
  'SOF': [{ name: 'Hamida Gosa', shares: 2 }],
  'NFS': [{ name: 'Jilaluden Alewi Muzeyn', shares: 0.5 }, { name: 'Tsegaye Feseha Asfaw', shares: 0.5 }, { name: 'Nebyi Tekle', shares: 1 }],
  'ERT': [{ name: 'Kahasse Asgele Haile', shares: 0.25 }],
  'CLO': [{ name: 'Netsanet Demelash Tafes', shares: 1 }, { name: 'Anteneh Demelash Tafese', shares: 3 }],
  'MGN': [{ name: 'Tefetere Negash Abaerie', shares: 2 }],
  'MEX': [{ name: 'Teklit Keflay Lemlem', shares: 0.5 }],
  'BCB': [{ name: 'Teshome Daniel Aruse', shares: 1 }],
  'ALR': [{ name: 'Mubarek Adibeb Hassen', shares: 0.5 }],
  'FIN': [{ name: 'Wubliker Mengistu Abebe', shares: 1 }],
  'GNW': [{ name: 'Hailemariam Munie', shares: 2 }],
  'AGO': [{ name: 'Hailemariam Munie', shares: 2 }],
  'BSL': [{ name: 'Hailemariam Munie', shares: 2 }],
  'MIS': [{ name: 'Hailemariam Munie', shares: 2 }],
  'CMC': [{ name: 'Hailemariam Munie', shares: 2 }],
  'GAR': [{ name: 'Getachew Tazera Welalign', shares: 1 }, { name: 'Demelash Dereje Degefe', shares: 0.5 }, { name: 'Tesfalidet Teklezghi H/Michael', shares: 1 }, { name: 'Tabor Belda Gurmu', shares: 0.5 }, { name: 'Dawit Gezaehagn', shares: 2 }],
  'TDC': [{ name: 'Rishan Tekle Hadgu', shares: 0.5 }],
  'GOG': [{ name: 'Sifen Tokoma', shares: 0.5 }],
  'BNK': [{ name: 'Nebyi Tekle', shares: 1 }],
  'ATY': [{ name: 'Meseret Demelash', shares: 1 }],
  'KDM': [{ name: 'Gereziher Nguse', shares: 0.25 }, { name: 'Frehiwet Nega Haftie', shares: 1.5 }],
  'GUL': [{ name: 'Gereziher Nguse', shares: 0.25 }],
  'YBE': [{ name: 'Zelalem Tesfaye Bekele', shares: 3 }],
  'MLT': [{ name: 'Zelalem Tesfaye Bekele', shares: 3 }],
  'GSH': [{ name: 'Zelalem Demelash Tafese', shares: 0.5 }],
  'BAR': [{ name: 'Tsegaye Feseha Asfaw', shares: 0.5 }],
};

// Direct name → RAT member name mapping for lines that DO have member names
const NAME_MAP = {
  'ABDELFETAH RIEDWAN': 'Abdelfetah Riedwan',
  'ABEL BRHANE': 'Abel Birhane Faye',
  'ABEL BRHANU': 'Abel Birhane Faye',
  'ABRAHAM ZEREZGI': 'Abraham Zerezgi Wmicaiel',
  'ADANE ABEJE': 'Adane Abeje Ayalew',
  'ALIAS ABEBE': 'Elias Abebe W/Michael',
  'ANTENEH DEMELASH': 'Anteneh Demelash Tafese',
  'ASHENAFI YOHANS': 'Ashenafi Yohannis Mehari',
  'BILAL BAHRU': 'Bilal Bahru Redi',
  'BILAL BRHANU': 'Bilal Bahru Redi',
  'BRHANU ALIAS': 'Birhanu Elias Gajabo',
  'DANIEAL MNYELET': 'Daniel Mnyelet',
  'DAWIT GEZAEHAGN': 'Dawit Gezaehagn',
  'DEJEN ALEM': 'Dejen Alem Kahsay',
  'DEMELASH DEREJE': 'Demelash Dereje Degefe',
  'DOLCHIE HAYELOM': 'Hayelom Yohanes Mahari',
  'DEREJE GASHAW(DERB)': 'Dereje Gashaw',
  'DEREJE GASHAW': 'Dereje Gashaw',
  'EDILU SEMA': 'Edilu Sema Zebere',
  'EDL': 'Edilu Sema Zebere',
  'EDLU SEMA': 'Edilu Sema Zebere',
  'ESMAEAL MEHAMED': 'Ismael Mohammed Idris',
  'FREHIWET NEGA': 'Frehiwet Nega Haftie',
  'GETACHEW TEZERA': 'Getachew Tazera Welalign',
  'GEREZIHER NGUSE': 'Gereziher Nguse',
  'HAILEMARIAM MUNIE': 'Hailemariam Munie',
  'HAMIDA GOSA/NEJAT NASIR': 'Hamida Gosa',
  'HAMIDA GOSA': 'Hamida Gosa',
  'NEJAT NASIR': 'Hamida Gosa',
  'JELADIN ALAWI': 'Jilaluden Alewi Muzeyn',
  'JELALDIN': 'Jilaluden Alewi Muzeyn',
  'KEHASE ASGELE': 'Kahasse Asgele Haile',
  'MESERET DEMELASH': 'Meseret Demelash',
  'MIKIIALE MESMERU': 'Michael Mesmeru Tiruneh',
  'MUBARK ADEBB': 'Mubarek Adibeb Hassen',
  'MUBARK DEBB': 'Mubarek Adibeb Hassen',
  'NEBYI TEKLE': 'Nebyi Tekle',
  'NETSANET DEMELASH': 'Netsanet Demelash Tafes',
  'RISHAN TEKLE': 'Rishan Tekle Hadgu',
  'SELAM TSEGAY': 'Selam Tsegaye Mekonnen',
  'SIFEN TOKOMA': 'Sifen Tokoma',
  'SHEMIISDIN KEDIR': 'Shemsedin Kedir Beleker',
  'SHEMIISDIN': 'Shemsedin Kedir Beleker',
  'TABOR BELDA': 'Tabor Belda Gurmu',
  'TABOR TEDLA': 'Tabor Belda Gurmu',
  'TEFETERE NEGASH': 'Tefetere Negash Abaerie',
  'TEKLIT KIFLAY': 'Teklit Keflay Lemlem',
  'TESFALIDET TEKLEZGI': 'Tesfalidet Teklezghi H/Michael',
  'TESFALIDET': 'Tesfalidet Teklezghi H/Michael',
  'TESHOME DANIEAL': 'Teshome Daniel Aruse',
  'TSEGAY FISHA': 'Tsegaye Feseha Asfaw',
  'URGE': 'Urge',
  'WBLIQER MENGSTU': 'Wubliker Mengistu Abebe',
  'WBBEKER MENGSTU': 'Wubliker Mengistu Abebe',
  'ZELALEM DEMELASH': 'Zelalem Demelash Tafese',
  'ZELALEM TESFAYE': 'Zelalem Tesfaye Bekele',
  'H/MICHAEL TEFERA': 'Tesfay Alem Kahsay',
  'TESFAY ALEM': 'Tesfay Alem Kahsay',
};

// Known member names in the PDF (sorted longest first for matching)
const PDF_MEMBER_NAMES = Object.keys(NAME_MAP).sort((a, b) => b.length - a.length);

function parseDate(dateStr) {
  if (!dateStr) return null;
  dateStr = dateStr.trim();
  const monNames = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
                     'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };

  // DD-Mon-YY (e.g., "17-Nov-25")
  let match = dateStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const mon = monNames[match[2].toLowerCase().slice(0, 3)];
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    if (mon) return new Date(`${year}-${mon}-${day}T00:00:00.000Z`);
  }

  // D/M/YYYY or D/M/YY (e.g., "8/2/2026" or "23/11/25")
  match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  // D/MON/YY (e.g., "16/NOV/25")
  match = dateStr.match(/^(\d{1,2})\/([A-Za-z]+)\/(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const mon = monNames[match[2].toLowerCase().slice(0, 3)];
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    if (mon) return new Date(`${year}-${mon}-${day}T00:00:00.000Z`);
  }

  return null;
}

function resolveMemberByBranch(branchCode, amount) {
  const candidates = BRANCH_TO_MEMBER[branchCode];
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].name;

  // Disambiguate by amount - expected amount per share is ~20,000-20,400
  const PER_SHARE = 20400;
  const TOLERANCE = 3000;

  for (const c of candidates) {
    const expected = c.shares * PER_SHARE;
    if (Math.abs(amount - expected) < TOLERANCE) return c.name;
    // Check multiples (paying for multiple cycles)
    for (let mult = 2; mult <= 6; mult++) {
      if (Math.abs(amount - expected * mult) < TOLERANCE * mult) return c.name;
    }
  }

  // If amount doesn't help, check by closest shares match
  const shareEstimate = amount / PER_SHARE;
  let closest = candidates[0];
  let minDiff = Math.abs(candidates[0].shares - shareEstimate);
  for (const c of candidates) {
    const diff = Math.abs(c.shares - shareEstimate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return closest.name;
}

function extractAllDeposits(fullText) {
  const deposits = [];

  // Strategy: Parse the full text to find cycle sections, then extract FT-based deposits
  // First, identify cycle boundaries using headers
  const cycleHeaderPattern = /(\d+)(?:ST|ND|RD|TH)\s*\/?/gi;
  const headers = [];
  let hMatch;
  while ((hMatch = cycleHeaderPattern.exec(fullText)) !== null) {
    const num = parseInt(hMatch[1]);
    if (num >= 1 && num <= 30) {
      headers.push({ cycleNumber: num, pos: hMatch.index + hMatch[0].length });
    }
  }

  // Deduplicate headers at similar positions
  const uniqueHeaders = [];
  for (const h of headers) {
    const dup = uniqueHeaders.find(u => u.cycleNumber === h.cycleNumber && Math.abs(u.pos - h.pos) < 200);
    if (!dup) uniqueHeaders.push(h);
  }
  uniqueHeaders.sort((a, b) => a.pos - b.pos);

  // For each section between headers, extract deposits
  for (let hi = 0; hi < uniqueHeaders.length; hi++) {
    const cycleNum = uniqueHeaders[hi].cycleNumber;
    if (cycleNum > 23) continue; // Skip cycles 24+ (already imported from bank statement)

    const startPos = uniqueHeaders[hi].pos;
    const endPos = hi < uniqueHeaders.length - 1 ? uniqueHeaders[hi + 1].pos : startPos + 3000;
    const sectionText = fullText.substring(startPos, Math.min(endPos, startPos + 5000));

    // Split into lines
    const lines = sectionText.split('\n');

    for (const line of lines) {
      if (line.trim().length < 8) continue;

      // Find all FT numbers in this line (with branch codes)
      const ftPattern = /(?:FT|ft|FTRQ|CHDP)\d{4,6}[A-Z0-9]+(?:\\[A-Z]+)?/gi;
      const ftMatches = [];
      let fm;
      while ((fm = ftPattern.exec(line)) !== null) {
        ftMatches.push({ full: fm[0], pos: fm.index });
      }

      if (ftMatches.length === 0) continue;

      // Try to identify the member from the line
      let memberName = null;
      const upperLine = line.toUpperCase();

      // Check if line starts with a known member name
      for (const name of PDF_MEMBER_NAMES) {
        if (upperLine.includes(name)) {
          memberName = NAME_MAP[name];
          break;
        }
      }

      // Process each FT number
      for (let fi = 0; fi < ftMatches.length; fi++) {
        const ftFull = ftMatches[fi].full;
        const ftPos = ftMatches[fi].pos;

        // Clean FT number: remove branch code for storage (strip \BRANCH)
        const backslashIdx = ftFull.indexOf('\\');
        const ftClean = backslashIdx !== -1 ? ftFull.substring(0, backslashIdx) : ftFull;
        const branchCode = backslashIdx !== -1 ? ftFull.substring(backslashIdx + 1) : null;

        // Find amount before this FT number
        const textBeforeFT = line.substring(Math.max(0, ftPos - 80), ftPos);
        const amountMatches = textBeforeFT.match(/(\d{1,3}(?:,\d{3})+)/g);
        let amount = null;
        if (amountMatches) {
          // Take the last amount before FT that's a reasonable deposit amount
          for (let ai = amountMatches.length - 1; ai >= 0; ai--) {
            const val = parseInt(amountMatches[ai].replace(/,/g, ''));
            if (val >= 4500 && val <= 500000) {
              amount = val;
              break;
            }
          }
        }

        if (!amount) continue;

        // Filter out parsing artifacts: amounts like 255,000 or 265,000 are from
        // concatenated text like "0.255,000" (shares 0.25 + contribution 5,000)
        if (amount === 255000 || amount === 265000 || amount === 122400) continue;

        // Find date before this FT number
        const datePatterns = [
          /(\d{1,2}-[A-Za-z]+-\d{2,4})/g,
          /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
          /(\d{1,2}\/[A-Za-z]+\/\d{2,4})/g,
        ];
        let date = null;
        const textForDate = line.substring(Math.max(0, ftPos - 120), ftPos);
        for (const dp of datePatterns) {
          let dm;
          while ((dm = dp.exec(textForDate)) !== null) {
            const parsed = parseDate(dm[1]);
            if (parsed) date = parsed;
          }
        }

        // Resolve member
        let resolvedMember = memberName;
        if (!resolvedMember && branchCode) {
          resolvedMember = resolveMemberByBranch(branchCode, amount);
        }

        if (resolvedMember) {
          deposits.push({
            ftNumber: ftClean.toUpperCase(),
            branchCode,
            amount,
            date,
            memberName: resolvedMember,
            cycleNumber: cycleNum,
          });
        }
      }
    }
  }

  return deposits;
}

async function main() {
  console.log('📄 Parsing KAZA EUQUB PDF for RAT group...\n');

  // 1. Read and parse PDF
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const pdfData = await pdf(dataBuffer);
  const fullText = pdfData.text;

  console.log(`  Pages: ${pdfData.numpages}`);
  console.log(`  Text length: ${fullText.length} chars\n`);

  // 2. Get group members
  const group = await prisma.equbGroup.findUnique({
    where: { id: GROUP_ID },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, bankAccountName: true } }
        }
      }
    }
  });

  if (!group) throw new Error(`Group ${GROUP_ID} not found`);
  console.log(`✅ Group: ${group.name} (${group.memberships.length} members)\n`);

  // Build member lookup
  const memberByName = {};
  for (const m of group.memberships) {
    memberByName[m.user.name] = m;
  }

  // 3. Get existing cycles
  const existingCycles = await prisma.cycle.findMany({
    where: { groupId: GROUP_ID },
    orderBy: { cycleNumber: 'asc' },
  });

  const cycleMap = {};
  for (const c of existingCycles) {
    cycleMap[c.cycleNumber] = c;
  }
  console.log(`📅 Existing cycles: ${existingCycles.length} (${existingCycles[0]?.cycleNumber}-${existingCycles[existingCycles.length - 1]?.cycleNumber})\n`);

  // 4. Parse deposits
  console.log('🔍 Extracting deposits from PDF...\n');
  const deposits = extractAllDeposits(fullText);
  console.log(`📊 Found ${deposits.length} deposit entries\n`);

  // 5. Insert deposits
  let created = 0;
  let duplicates = 0;
  let unmatched = [];
  let noCycle = 0;
  let errors = 0;

  for (const dep of deposits) {
    const member = memberByName[dep.memberName];
    if (!member) {
      unmatched.push(dep);
      continue;
    }

    const cycle = cycleMap[dep.cycleNumber];
    if (!cycle) {
      noCycle++;
      continue;
    }

    // Check for duplicate FT number
    const existing = await prisma.deposit.findUnique({
      where: { ftNumber: dep.ftNumber }
    });
    if (existing) {
      duplicates++;
      continue;
    }

    // Deposit date - validate before use
    let depositDate = dep.date;
    if (!depositDate || isNaN(depositDate.getTime())) {
      depositDate = cycle.startDate;
    }

    // Create deposit
    try {
      await prisma.deposit.create({
        data: {
          cycleId: cycle.id,
          userId: member.user.id,
          imageUrl: 'kaza-ledger-import',
          ftNumber: dep.ftNumber,
          amount: dep.amount,
          bankName: 'CBE',
          depositDate: depositDate,
          senderName: dep.memberName,
          receiverAccount: '1000734617664',
          verificationStatus: 'VERIFIED',
          confidence: 1.0,
        }
      });
      created++;
      console.log(`  ✅ [Cycle ${dep.cycleNumber}] ${dep.memberName} — ${dep.amount.toLocaleString()} ETB (${dep.ftNumber}${dep.branchCode ? '\\' + dep.branchCode : ''})`);
    } catch (err) {
      if (err.code === 'P2002') {
        duplicates++;
      } else {
        errors++;
        console.log(`  ❌ Error: ${err.message} (${dep.ftNumber})`);
      }
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Import Summary:');
  console.log(`   Total entries found:    ${deposits.length}`);
  console.log(`   Deposits created:       ${created}`);
  console.log(`   Duplicates skipped:     ${duplicates}`);
  console.log(`   No cycle found:         ${noCycle}`);
  console.log(`   Unmatched members:      ${unmatched.length}`);
  console.log(`   Errors:                 ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (unmatched.length > 0) {
    const uniqueNames = [...new Set(unmatched.map(u => u.memberName))];
    console.log('\n⚠️  Unmatched member names:');
    uniqueNames.forEach(n => console.log(`   - "${n}"`));
  }

  // Per-cycle breakdown
  console.log('\n📅 Deposits created per cycle:');
  const perCycle = {};
  deposits.forEach(d => {
    if (!perCycle[d.cycleNumber]) perCycle[d.cycleNumber] = 0;
    perCycle[d.cycleNumber]++;
  });
  Object.keys(perCycle).sort((a, b) => Number(a) - Number(b)).forEach(cn => {
    console.log(`   Cycle ${cn}: ${perCycle[cn]} entries`);
  });

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
