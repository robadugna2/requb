const fs = require('fs');
const pdf = require('pdf-parse');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const GROUP_ID = 'cmqh5w5ft0004setfpb6z2jde';
const PDF_PATH = 'C:/Users/Abrsh-1/Downloads/KAZA EUQUB (4).pdf';

// ─────────────────────────────────────────────────────────────
// CYCLE DEFINITIONS (weekly schedule, cycles 1-23)
// ─────────────────────────────────────────────────────────────
const CYCLES = [
  { number: 1, start: '2025-11-10', end: '2025-11-16' },
  { number: 2, start: '2025-11-17', end: '2025-11-23' },
  { number: 3, start: '2025-11-24', end: '2025-11-30' },
  { number: 4, start: '2025-12-01', end: '2025-12-07' },
  { number: 5, start: '2025-12-08', end: '2025-12-14' },
  { number: 6, start: '2025-12-15', end: '2025-12-21' },
  { number: 7, start: '2025-12-22', end: '2025-12-28' },
  { number: 8, start: '2025-12-29', end: '2026-01-04' },
  { number: 9, start: '2026-01-05', end: '2026-01-11' },
  { number: 10, start: '2026-01-12', end: '2026-01-18' },
  { number: 11, start: '2026-01-19', end: '2026-01-25' },
  { number: 12, start: '2026-01-26', end: '2026-02-01' },
  { number: 13, start: '2026-02-02', end: '2026-02-08' },
  { number: 14, start: '2026-02-09', end: '2026-02-15' },
  { number: 15, start: '2026-02-16', end: '2026-02-22' },
  { number: 16, start: '2026-02-23', end: '2026-03-01' },
  { number: 17, start: '2026-03-02', end: '2026-03-08' },
  { number: 18, start: '2026-03-09', end: '2026-03-15' },
  { number: 19, start: '2026-03-16', end: '2026-03-22' },
  { number: 20, start: '2026-03-23', end: '2026-03-29' },
  { number: 21, start: '2026-03-30', end: '2026-04-05' },
  { number: 22, start: '2026-04-06', end: '2026-04-12' },
  { number: 23, start: '2026-04-13', end: '2026-04-19' },
];

// ─────────────────────────────────────────────────────────────
// MEMBER DEFINITIONS (in PDF order)
// ─────────────────────────────────────────────────────────────
const MEMBER_ORDER = [
  { pdfName: 'ABDELFETAH RIEDWAN', userId: 'cmql5fjgi000014mx5rdu1l36', shares: 1, dbName: 'Abdelfetah Riedwan' },
  { pdfName: 'ABEL BRHANE', userId: 'cmql5fkzk000314mx9mrarlvz', shares: 3, dbName: 'Abel Birhane Faye' },
  { pdfName: 'ABRAHAM ZEREZGI', userId: 'cmql5flo7000614mxy8ovma3g', shares: 0.25, dbName: 'Abraham Zerezgi Wmicaiel' },
  { pdfName: 'ADANE ABEJE', userId: 'cmql5fmeu000914mxu0svkkut', shares: 1, dbName: 'Adane Abeje Ayalew' },
  { pdfName: 'ALIAS ABEBE', userId: 'cmql5fvgs001614mxey9vl0gr', shares: 0.5, dbName: 'Elias Abebe W/Michael' },
  { pdfName: 'ANTENEH DEMELASH', userId: 'cmql5fn3s000c14mxhegig0ol', shares: 3, dbName: 'Anteneh Demelash Tafese' },
  { pdfName: 'ASHENAFI YOHANS', userId: 'cmql5fnrr000f14mxxloxwddy', shares: 1, dbName: 'Ashenafi Yohannis Mehari' },
  { pdfName: 'BILAL BRHANU', userId: 'cmql5foqv000i14mxznlogi6c', shares: 1, dbName: 'Bilal Bahru Redi' },
  { pdfName: 'BRHANU ALIAS', userId: 'cmql5fppg000l14mxem9847sp', shares: 0.5, dbName: 'Birhanu Elias Gajabo' },
  { pdfName: 'DANIEAL MNYELET', userId: 'cmql5fqfp000o14mxfpocji4p', shares: 1, dbName: 'Daniel Mnyelet' },
  { pdfName: 'DAWIT GEZAEHAGN', userId: 'cmql5frfd000r14mxc8fp6hu3', shares: 2, dbName: 'Dawit Gezaehagn' },
  { pdfName: 'DEJEN ALEM', userId: 'cmql5fsf4000u14mxpm17bv0f', shares: 0.25, dbName: 'Dejen Alem Kahsay' },
  { pdfName: 'DEMELASH DEREJE', userId: 'cmql5ft1r000x14mxt0for3m6', shares: 0.5, dbName: 'Demelash Dereje Degefe' },
  { pdfName: 'DOLCHIE HAYELOM', userId: 'cmql5fzaj001o14mxrbv12f6r', shares: 1, dbName: 'Hayelom Yohanes Mahari' },
  { pdfName: 'DEREJE GASHAW', userId: 'cmql5fu5p001014mxtjbxjcw4', shares: 2, dbName: 'Dereje Gashaw' },
  { pdfName: 'EDILU SEMA', userId: 'cmql5fush001314mxkmyjel68', shares: 0.5, dbName: 'Edilu Sema Zebere' },
  { pdfName: 'ESMAEAL MEHAMED', userId: 'cmql5fzxl001r14mxp6vk525q', shares: 1, dbName: 'Ismael Mohammed Idris' },
  { pdfName: 'FREHIWET NEGA', userId: 'cmql5fw3u001914mxboilr1a3', shares: 1.5, dbName: 'Frehiwet Nega Haftie' },
  { pdfName: 'GETACHEW TEZERA', userId: 'cmql5fwrr001c14mx7kyj1exx', shares: 1, dbName: 'Getachew Tazera Welalign' },
  { pdfName: 'GEREZIHER NGUSE', userId: 'cmql5fxed001f14mxll03fins', shares: 0.25, dbName: 'Gereziher Nguse' },
  { pdfName: 'HAILEMARIAM MUNIE', userId: 'cmql5fy1l001i14mx0aj9mow2', shares: 2, dbName: 'Hailemariam Munie' },
  { pdfName: 'HAMIDA GOSA', userId: 'cmql5fynm001l14mx71rqn594', shares: 2, dbName: 'Hamida Gosa' },
  { pdfName: 'JELADIN ALAWI', userId: 'cmql5g0zb001u14mxuxaq3t3l', shares: 0.5, dbName: 'Jilaluden Alewi Muzeyn' },
  { pdfName: 'KEHASE ASGELE', userId: 'cmql5g22p001x14mxmzdxh74d', shares: 0.25, dbName: 'Kahasse Asgele Haile' },
  { pdfName: 'MESERET DEMELASH', userId: 'cmql5g3c4002314mxjqhlw3my', shares: 1, dbName: 'Meseret Demelash' },
  { pdfName: 'MIKIALE MESMERU', userId: 'cmql5g3yo002614mxtmyaam7d', shares: 2, dbName: 'Michael Mesmeru Tiruneh' },
  { pdfName: 'MUBARK ADEBB', userId: 'cmql5g57l002c14mx7z0u7j1g', shares: 0.5, dbName: 'Mubarek Adibeb Hassen' },
  { pdfName: 'NEBYI TEKLE', userId: 'cmql5g6bd002f14mx57vx07vu', shares: 1, dbName: 'Nebyi Tekle' },
  { pdfName: 'NETSANET DEMELASH', userId: 'cmql5g78z002i14mx74d8kond', shares: 1, dbName: 'Netsanet Demelash Tafes' },
  { pdfName: 'RISHAN TEKLE', userId: 'cmql5g7va002l14mxeahnvjb1', shares: 0.5, dbName: 'Rishan Tekle Hadgu' },
  { pdfName: 'SELAM TSEGAY', userId: 'cmql5g8us002o14mxku8szgdt', shares: 0.5, dbName: 'Selam Tsegaye Mekonnen' },
  { pdfName: 'SIFEN TOKOMA', userId: 'cmql5ga9g002u14mxvxvrkv90', shares: 0.5, dbName: 'Sifen Tokoma' },
  { pdfName: 'SHEMIISDIN KEDIR', userId: 'cmql5g9k4002r14mxf54x99w2', shares: 0.5, dbName: 'Shemsedin Kedir Beleker' },
  { pdfName: 'TABOR BELDA', userId: 'cmql5gb7p002x14mx7pju414i', shares: 0.5, dbName: 'Tabor Belda Gurmu' },
  { pdfName: 'TEFETERE NEGASH', userId: 'cmql5gbx4003014mx29a0tfrm', shares: 2, dbName: 'Tefetere Negash Abaerie' },
  { pdfName: 'TEKLIT KIFLAY', userId: 'cmql5gcmq003314mxp1taidhr', shares: 0.5, dbName: 'Teklit Keflay Lemlem' },
  { pdfName: 'TESFALIDET', userId: 'cmql5gdn4003614mxdtorwtxq', shares: 1, dbName: 'Tesfalidet Teklezghi H/Michael' },
  { pdfName: 'TESHOME DANIEAL', userId: 'cmql5gf0i003c14mxqck2k8tv', shares: 1, dbName: 'Teshome Daniel Aruse' },
  { pdfName: 'TSEGAY FISHA', userId: 'cmql5gfpj003f14mxhwfldt4w', shares: 0.5, dbName: 'Tsegaye Feseha Asfaw' },
  { pdfName: 'URGE', userId: 'cmql5ggpi003i14mxnu2dbmzw', shares: 0.25, dbName: 'Urge' },
  { pdfName: 'WBLIQER MENGSTU', userId: 'cmql5ghw9003l14mxrvo0k393', shares: 1, dbName: 'Wubliker Mengistu Abebe' },
  { pdfName: 'ZELALEM DEMELASH', userId: 'cmql5gihy003o14mx6xpafifr', shares: 0.5, dbName: 'Zelalem Demelash Tafese' },
  { pdfName: 'ZELALEM TESFAYE', userId: 'cmql5gjgo003r14mx9u5fdx9s', shares: 3, dbName: 'Zelalem Tesfaye Bekele' },
  { pdfName: 'H/MICHAEL TEFERA', userId: 'cmql5geaz003914mxq52mgf3n', shares: 2, dbName: 'Tesfay Alem Kahsay' },
];

// Alternative PDF name patterns for matching
const PDF_NAME_ALIASES = {
  'BILAL BAHRU': 7,
  'BILAL BRHANU': 7,
  'EDL': 15,
  'EDLU': 15,
  'SHEMSEDIN': 32,
  'SHEMISDIN': 32,
  'TABOR TEDLA': 33,
  'TESFALIDET TEKLEZGI': 36,
  'WBBEQER': 40,
  'WUBBEQER': 40,
  'WUBLIQER': 40,
  'NEJAT NASIR': 21,
  'DOLCHIE': 13,
  'DERB': 14,
};

// ─────────────────────────────────────────────────────────────
// DATE PARSING
// ─────────────────────────────────────────────────────────────
const MONTH_MAP = {
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
};

function parseDate(dateStr) {
  if (!dateStr) return null;
  dateStr = dateStr.trim().replace(/\s+/g, '');

  // Format: DD-Mon-YY (e.g., 17-Nov-25, 14-Nov-25)
  let m = dateStr.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = MONTH_MAP[m[2].toLowerCase()];
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // Format: DD/MM/YY or DD/MM/YYYY (e.g., 11/11/2025, 9/11/2025, 8/2/2026)
  m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day));
  }

  // Format: DD-MM-YY or DD-MM-YYYY
  m = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day));
  }

  // Format: D/M/YYYY with + separator (multiple dates)
  m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    let year = parseInt(m[3]);
    return new Date(Date.UTC(year, month, day));
  }

  return null;
}

function getCycleForDate(date) {
  if (!date) return null;
  const dateMs = date.getTime();

  for (const cycle of CYCLES) {
    const start = new Date(cycle.start + 'T00:00:00.000Z');
    const end = new Date(cycle.end + 'T23:59:59.999Z');
    if (dateMs >= start.getTime() && dateMs <= end.getTime()) {
      return cycle.number;
    }
  }

  // If date is slightly outside range, find closest cycle (within 3 days tolerance)
  let closest = null;
  let minDiff = Infinity;
  for (const cycle of CYCLES) {
    const start = new Date(cycle.start + 'T00:00:00.000Z').getTime();
    const end = new Date(cycle.end + 'T23:59:59.999Z').getTime();
    const diffStart = Math.abs(dateMs - start);
    const diffEnd = Math.abs(dateMs - end);
    const diff = Math.min(diffStart, diffEnd);
    if (diff < minDiff) {
      minDiff = diff;
      closest = cycle.number;
    }
  }

  // Only return if within 3 days
  if (minDiff <= 3 * 24 * 60 * 60 * 1000) {
    return closest;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// PDF TEXT PARSING
// ─────────────────────────────────────────────────────────────

/**
 * Extract all FT number entries from the PDF text.
 * Each entry has: ftNumber, date (raw string), amount, contextBefore (for member identification)
 */
function extractAllFTEntries(text) {
  const entries = [];

  // FT pattern: FT followed by 5 digits then alphanumeric chars
  const ftRegex = /FT\d{5}[A-Z0-9]+/gi;
  let match;

  while ((match = ftRegex.exec(text)) !== null) {
    const ftNumber = match[0].toUpperCase();
    const ftPos = match.index;

    // Get context before FT number (up to 200 chars back)
    const contextStart = Math.max(0, ftPos - 200);
    const contextBefore = text.substring(contextStart, ftPos);

    // Get context after FT number (for branch codes, next entries)
    const contextAfter = text.substring(ftPos + ftNumber.length, Math.min(text.length, ftPos + ftNumber.length + 50));

    // Extract amount: look for number pattern just before the FT number
    // Amount patterns: 20,400 or 20400 or 5,000 or 61,200 etc.
    let amount = null;
    const amountMatch = contextBefore.match(/([\d,]+(?:\.\d+)?)\s*$/);
    if (amountMatch) {
      const rawAmount = amountMatch[1].replace(/,/g, '');
      const parsed = parseFloat(rawAmount);
      // Valid amounts are between 1,000 and 200,000
      if (parsed >= 1000 && parsed <= 200000) {
        amount = parsed;
      }
    }

    // If no amount found with comma pattern, try without
    if (!amount) {
      const amountMatch2 = contextBefore.match(/(\d{4,6})\s*$/);
      if (amountMatch2) {
        const parsed = parseFloat(amountMatch2[1]);
        if (parsed >= 1000 && parsed <= 200000) {
          amount = parsed;
        }
      }
    }

    // Extract date: look before the amount in the context
    let dateStr = null;
    let parsedDate = null;

    // Try various date patterns in the context before FT
    // Pattern: DD-Mon-YY or DD/Mon/YY
    const datePatterns = [
      /(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/g,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{1,2}-\d{1,2}-\d{2,4})/g,
    ];

    for (const dp of datePatterns) {
      dp.lastIndex = 0;
      let dm;
      const matches = [];
      while ((dm = dp.exec(contextBefore)) !== null) {
        matches.push(dm[1]);
      }
      // Take the last date match (closest to FT number)
      if (matches.length > 0) {
        const candidate = matches[matches.length - 1];
        const pd = parseDate(candidate);
        if (pd && pd.getFullYear() >= 2025 && pd.getFullYear() <= 2026) {
          dateStr = candidate;
          parsedDate = pd;
          break;
        }
      }
    }

    entries.push({
      ftNumber,
      amount,
      dateStr,
      parsedDate,
      contextBefore: contextBefore.slice(-100),
      contextAfter: contextAfter.slice(0, 30),
      position: ftPos,
    });
  }

  return entries;
}

/**
 * Parse cycle sections from the PDF text.
 * Returns a map of section ranges: { cycleNumbers: [n], startPos, endPos }
 */
function identifySections(text) {
  const sections = [];

  // Look for section headers
  const headerPatterns = [
    { regex: /NAME\s*1\s*ST/gi, cycles: [1] },
    { regex: /\b13\s*TH\b/gi, cycles: [13] },
    { regex: /\b2\s*ND\s*\/?\s*DATE/gi, cycles: [2, 3] },
    { regex: /\b3\s*RD\s*\/?\s*DATE/gi, cycles: [2, 3] },
    { regex: /\b4\s*TH\b/gi, cycles: [4, 5] },
    { regex: /\b5\s*TH\b/gi, cycles: [4, 5] },
    { regex: /\b6\s*TH\b/gi, cycles: [6, 7] },
    { regex: /\b7\s*TH\b/gi, cycles: [6, 7] },
    { regex: /\b8\s*TH\b/gi, cycles: [8, 9, 10] },
    { regex: /\b9\s*TH\b/gi, cycles: [8, 9, 10] },
    { regex: /\b10\s*TH\b/gi, cycles: [8, 9, 10] },
    { regex: /\b11\s*TH\b/gi, cycles: [11, 12] },
    { regex: /\b12\s*TH\b/gi, cycles: [11, 12] },
    { regex: /\b14\s*TH\b/gi, cycles: [14, 15] },
    { regex: /\b15\s*TH\b/gi, cycles: [14, 15] },
    { regex: /\b16\s*TH\b/gi, cycles: [16, 17] },
    { regex: /\b17\s*TH\b/gi, cycles: [16, 17] },
    { regex: /\b18\s*TH\b/gi, cycles: [18, 19] },
    { regex: /\b19\s*TH\b/gi, cycles: [18, 19] },
    { regex: /\b20\s*TH\b/gi, cycles: [20, 21, 22] },
    { regex: /\b21\s*ST\b/gi, cycles: [20, 21, 22] },
    { regex: /\b22\s*ND\b/gi, cycles: [20, 21, 22] },
    { regex: /\b23\s*RD\b/gi, cycles: [23, 24] },
    { regex: /\b24\s*TH\b/gi, cycles: [23, 24] },
  ];

  // We don't strictly need section boundaries if we use date-based cycle assignment
  // This is kept for potential positional member matching
  return sections;
}

/**
 * For named sections (cycles 1 and 13), parse member-FT associations directly.
 * Returns array of { memberIndex, ftNumber, amount, date }
 */
function parseNamedSection(text, sectionText) {
  const results = [];

  for (let i = 0; i < MEMBER_ORDER.length; i++) {
    const member = MEMBER_ORDER[i];
    const nameUpper = member.pdfName;

    // Find this member's name in the section
    const namePos = sectionText.toUpperCase().indexOf(nameUpper);
    if (namePos === -1) continue;

    // Get text from this member's name to the next member's name (or end)
    let endPos = sectionText.length;
    for (let j = i + 1; j < MEMBER_ORDER.length; j++) {
      const nextPos = sectionText.toUpperCase().indexOf(MEMBER_ORDER[j].pdfName, namePos + nameUpper.length);
      if (nextPos !== -1) {
        endPos = nextPos;
        break;
      }
    }

    const memberLine = sectionText.substring(namePos, endPos);

    // Extract all FT numbers from this member's line
    const ftRegex = /FT\d{5}[A-Z0-9]+/gi;
    let ftMatch;
    while ((ftMatch = ftRegex.exec(memberLine)) !== null) {
      const ftNumber = ftMatch[0].toUpperCase();

      // Get context before this FT for amount and date
      const beforeFT = memberLine.substring(0, ftMatch.index);

      // Extract amount (last number before FT)
      let amount = null;
      const amtMatch = beforeFT.match(/([\d,]+)\s*$/);
      if (amtMatch) {
        amount = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (amount < 1000 || amount > 200000) amount = null;
      }

      // Extract date
      let parsedDate = null;
      const datePatterns = [
        /(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/g,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      ];
      for (const dp of datePatterns) {
        dp.lastIndex = 0;
        let dm;
        const matches = [];
        while ((dm = dp.exec(beforeFT)) !== null) {
          matches.push(dm[1]);
        }
        if (matches.length > 0) {
          parsedDate = parseDate(matches[matches.length - 1]);
          if (parsedDate) break;
        }
      }

      results.push({
        memberIndex: i,
        ftNumber,
        amount,
        parsedDate,
        memberName: member.dbName,
        userId: member.userId,
      });
    }
  }

  return results;
}

/**
 * For multi-column sections (non-named), assign FT entries to members by position.
 * The entries appear in fixed member order within each cycle column.
 */
function assignByPosition(ftEntries, cycleNumbers, sectionStart, sectionEnd) {
  const results = [];

  // Filter entries within this section's position range
  const sectionEntries = ftEntries.filter(e =>
    e.position >= sectionStart && e.position < sectionEnd
  );

  if (sectionEntries.length === 0) return results;

  // Sort by position
  sectionEntries.sort((a, b) => a.position - b.position);

  const numCycles = cycleNumbers.length;
  const membersPerCycle = MEMBER_ORDER.length; // 44

  // Determine which cycle each entry belongs to using its date
  for (const entry of sectionEntries) {
    if (!entry.parsedDate || !entry.amount) continue;

    const cycleNum = getCycleForDate(entry.parsedDate);
    if (cycleNum && cycleNumbers.includes(cycleNum)) {
      // We know the cycle from the date; member assignment needs position
      results.push({
        ...entry,
        cycleNumber: cycleNum,
        needsMemberAssignment: true,
      });
    }
  }

  return results;
}

/**
 * Match a member by amount (expected contribution = shares * 20,000 base, or shares * 20,400 with fee)
 * Returns array of candidate member indices
 */
function getMemberCandidatesByAmount(amount) {
  const candidates = [];
  const TOLERANCE = 500;

  for (let i = 0; i < MEMBER_ORDER.length; i++) {
    const member = MEMBER_ORDER[i];
    const expectedBase = member.shares * 20000;
    const expectedWithFee = member.shares * 20400;

    if (Math.abs(amount - expectedBase) <= TOLERANCE ||
        Math.abs(amount - expectedWithFee) <= TOLERANCE) {
      candidates.push(i);
    }

    // Check partial payments (half)
    if (Math.abs(amount - expectedBase / 2) <= TOLERANCE ||
        Math.abs(amount - expectedWithFee / 2) <= TOLERANCE) {
      candidates.push(i);
    }
  }

  return candidates;
}

/**
 * Determine member from context (text before the FT number may contain name fragments)
 */
function getMemberFromContext(contextBefore) {
  const ctx = contextBefore.toUpperCase();

  // Check each member's PDF name
  for (let i = 0; i < MEMBER_ORDER.length; i++) {
    const member = MEMBER_ORDER[i];
    if (ctx.includes(member.pdfName)) {
      return i;
    }
    // Check first word of name (at least 4 chars)
    const firstName = member.pdfName.split(' ')[0];
    if (firstName.length >= 4 && ctx.includes(firstName)) {
      return i;
    }
  }

  // Check aliases
  for (const [alias, idx] of Object.entries(PDF_NAME_ALIASES)) {
    if (ctx.includes(alias)) {
      return idx;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// MAIN HYBRID PARSING STRATEGY
// ─────────────────────────────────────────────────────────────

/**
 * The main parsing function that combines multiple strategies:
 * 1. Extract ALL FT entries from the full text
 * 2. For each FT entry, determine cycle from date
 * 3. For member assignment:
 *    a. Check if context contains a member name (works for cycles 1 & 13)
 *    b. Use positional matching within sections
 *    c. Use amount-based matching as fallback
 */
function parseAllTransactions(text) {
  const transactions = [];
  const seenFT = new Set();

  // Strategy 1: Extract all FT numbers with context
  const allEntries = extractAllFTEntries(text);
  console.log(`  Raw FT entries found: ${allEntries.length}`);

  // Strategy 2: For each entry, try to assign cycle and member
  for (const entry of allEntries) {
    if (!entry.ftNumber || seenFT.has(entry.ftNumber)) continue;
    if (!entry.amount && !entry.parsedDate) continue;

    // Determine cycle from date
    let cycleNumber = null;
    if (entry.parsedDate) {
      cycleNumber = getCycleForDate(entry.parsedDate);
    }

    // Try to determine member from context
    let memberIndex = getMemberFromContext(entry.contextBefore);

    // If no member found from context, try amount-based matching
    // (only useful if the amount uniquely identifies a member)
    if (memberIndex === null && entry.amount) {
      const candidates = getMemberCandidatesByAmount(entry.amount);
      if (candidates.length === 1) {
        memberIndex = candidates[0];
      }
    }

    if (memberIndex !== null && cycleNumber !== null && entry.amount) {
      seenFT.add(entry.ftNumber);
      transactions.push({
        ftNumber: entry.ftNumber,
        amount: entry.amount,
        parsedDate: entry.parsedDate,
        cycleNumber,
        memberIndex,
        userId: MEMBER_ORDER[memberIndex].userId,
        memberName: MEMBER_ORDER[memberIndex].dbName,
        source: 'context+date',
      });
    } else if (cycleNumber !== null && entry.amount) {
      // We have date and amount but no member - store for positional assignment
      seenFT.add(entry.ftNumber);
      transactions.push({
        ftNumber: entry.ftNumber,
        amount: entry.amount,
        parsedDate: entry.parsedDate,
        cycleNumber,
        memberIndex: null,
        userId: null,
        memberName: null,
        source: 'date-only',
      });
    }
  }

  // Strategy 3: Positional parsing for multi-column sections
  // We'll try to assign unmatched entries by their position in sections
  const unmatched = transactions.filter(t => t.memberIndex === null);
  const matched = transactions.filter(t => t.memberIndex !== null);

  console.log(`  Matched with context/amount: ${matched.length}`);
  console.log(`  Unmatched (need positional): ${unmatched.length}`);

  // For unmatched entries, try to use positional ordering within each cycle
  // Group unmatched by cycle and sort by position in text
  const unmatchedByCycle = {};
  for (const entry of unmatched) {
    if (!unmatchedByCycle[entry.cycleNumber]) {
      unmatchedByCycle[entry.cycleNumber] = [];
    }
    unmatchedByCycle[entry.cycleNumber].push(entry);
  }

  // For each cycle's unmatched entries, try sequential member assignment
  // This works because entries in multi-column sections follow fixed member order
  let positionalMatched = 0;
  for (const [cycleNum, entries] of Object.entries(unmatchedByCycle)) {
    // Sort entries by their original position in the text
    entries.sort((a, b) => {
      const posA = allEntries.find(e => e.ftNumber === a.ftNumber)?.position || 0;
      const posB = allEntries.find(e => e.ftNumber === b.ftNumber)?.position || 0;
      return posA - posB;
    });

    // Find which members already have entries for this cycle (from matched set)
    const membersWithEntries = new Set(
      matched.filter(t => t.cycleNumber === parseInt(cycleNum)).map(t => t.memberIndex)
    );

    // Try to assign members sequentially, skipping those already assigned
    // Use amount validation to confirm assignment
    let memberIdx = 0;
    for (const entry of entries) {
      // Skip members already assigned for this cycle
      while (memberIdx < MEMBER_ORDER.length && membersWithEntries.has(memberIdx)) {
        memberIdx++;
      }
      if (memberIdx >= MEMBER_ORDER.length) break;

      // Validate amount against expected for this member
      const member = MEMBER_ORDER[memberIdx];
      const expectedBase = member.shares * 20000;
      const expectedWithFee = member.shares * 20400;
      const amtDiffBase = Math.abs(entry.amount - expectedBase);
      const amtDiffFee = Math.abs(entry.amount - expectedWithFee);

      // Check if amount roughly matches (within 20% tolerance for partial payments etc.)
      const maxExpected = Math.max(expectedBase, expectedWithFee);
      const isReasonable = entry.amount <= maxExpected * 1.5 && entry.amount >= maxExpected * 0.3;

      if (amtDiffBase <= 500 || amtDiffFee <= 500 || isReasonable) {
        entry.memberIndex = memberIdx;
        entry.userId = member.userId;
        entry.memberName = member.dbName;
        entry.source = 'positional';
        membersWithEntries.add(memberIdx);
        positionalMatched++;
        memberIdx++;
      } else {
        // Amount doesn't match - try next members
        let found = false;
        for (let tryIdx = memberIdx + 1; tryIdx < MEMBER_ORDER.length; tryIdx++) {
          if (membersWithEntries.has(tryIdx)) continue;
          const tryMember = MEMBER_ORDER[tryIdx];
          const tryExpBase = tryMember.shares * 20000;
          const tryExpFee = tryMember.shares * 20400;
          if (Math.abs(entry.amount - tryExpBase) <= 500 || Math.abs(entry.amount - tryExpFee) <= 500) {
            entry.memberIndex = tryIdx;
            entry.userId = tryMember.userId;
            entry.memberName = tryMember.dbName;
            entry.source = 'positional+amount';
            membersWithEntries.add(tryIdx);
            positionalMatched++;
            memberIdx = tryIdx + 1;
            found = true;
            break;
          }
        }
        if (!found) {
          memberIdx++;
        }
      }
    }
  }

  console.log(`  Positionally matched: ${positionalMatched}`);

  return transactions;
}

// ─────────────────────────────────────────────────────────────
// DATABASE OPERATIONS
// ─────────────────────────────────────────────────────────────

async function ensureCyclesExist() {
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
      console.log(`  Cycle ${cycleDef.number}: CREATED (${created.id})`);
    }
  }

  return cycleMap;
}

async function insertDeposits(transactions, cycleMap) {
  let depositsCreated = 0;
  let depositsSkipped = 0;
  let duplicates = 0;
  let noMember = 0;
  let noCycle = 0;
  const errors = [];

  for (const tx of transactions) {
    // Skip if no member assignment
    if (!tx.userId || !tx.memberIndex === null) {
      noMember++;
      continue;
    }

    // Skip if no cycle
    if (!tx.cycleNumber || !cycleMap[tx.cycleNumber]) {
      noCycle++;
      continue;
    }

    const cycleId = cycleMap[tx.cycleNumber];

    // Check for duplicate FT number
    try {
      const existing = await prisma.deposit.findFirst({
        where: { ftNumber: tx.ftNumber }
      });
      if (existing) {
        duplicates++;
        continue;
      }

      // Create deposit
      await prisma.deposit.create({
        data: {
          cycleId: cycleId,
          userId: tx.userId,
          imageUrl: 'kaza-euqub-ledger-import',
          ftNumber: tx.ftNumber,
          amount: tx.amount,
          bankName: 'CBE',
          depositDate: tx.parsedDate || new Date(CYCLES.find(c => c.number === tx.cycleNumber).start + 'T00:00:00.000Z'),
          senderName: tx.memberName,
          receiverAccount: '1000734617664',
          verificationStatus: 'VERIFIED',
          confidence: 0.9,
        }
      });
      depositsCreated++;
      console.log(`  ✅ Cycle ${tx.cycleNumber} | ${tx.memberName} | ${tx.amount.toLocaleString()} ETB | ${tx.ftNumber} [${tx.source}]`);
    } catch (err) {
      if (err.code === 'P2002') {
        // Unique constraint violation (duplicate FT)
        duplicates++;
      } else {
        errors.push({ tx, error: err.message });
        depositsSkipped++;
      }
    }
  }

  return { depositsCreated, depositsSkipped, duplicates, noMember, noCycle, errors };
}

// ─────────────────────────────────────────────────────────────
// CASH PAYMENT HANDLING
// Special entries marked as "(cash)" don't have FT numbers
// We generate synthetic IDs for them
// ─────────────────────────────────────────────────────────────
function extractCashPayments(text) {
  const cashEntries = [];
  // Pattern: amount + "(cash)" or "CASH"
  const cashRegex = /([\d,]+)\s*\(?\s*cash\s*\)?/gi;
  let match;

  while ((match = cashRegex.exec(text)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (amount >= 1000 && amount <= 200000) {
      const contextStart = Math.max(0, match.index - 150);
      const contextBefore = text.substring(contextStart, match.index);

      // Try to find date
      let parsedDate = null;
      const datePatterns = [
        /(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/g,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      ];
      for (const dp of datePatterns) {
        dp.lastIndex = 0;
        let dm;
        const matches = [];
        while ((dm = dp.exec(contextBefore)) !== null) {
          matches.push(dm[1]);
        }
        if (matches.length > 0) {
          parsedDate = parseDate(matches[matches.length - 1]);
          if (parsedDate) break;
        }
      }

      // Try to find member from context
      const memberIndex = getMemberFromContext(contextBefore);

      if (parsedDate && memberIndex !== null) {
        const cycleNumber = getCycleForDate(parsedDate);
        if (cycleNumber) {
          const syntheticFT = `CASH${cycleNumber.toString().padStart(2, '0')}${memberIndex.toString().padStart(2, '0')}${amount}`;
          cashEntries.push({
            ftNumber: syntheticFT,
            amount,
            parsedDate,
            cycleNumber,
            memberIndex,
            userId: MEMBER_ORDER[memberIndex].userId,
            memberName: MEMBER_ORDER[memberIndex].dbName,
            source: 'cash',
          });
        }
      }
    }
  }

  return cashEntries;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 KAZA EUQUB Ledger PDF Import');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 1. Read and parse PDF
  console.log('📖 Reading PDF...');
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at: ${PDF_PATH}`);
  }
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const pdfData = await pdf(dataBuffer);
  const fullText = pdfData.text;

  console.log(`  Pages: ${pdfData.numpages}`);
  console.log(`  Text length: ${fullText.length} chars`);
  console.log('');

  // Optional: Write extracted text to file for debugging
  const debugPath = 'scripts/kaza-euqub-extracted.txt';
  fs.writeFileSync(debugPath, fullText, 'utf8');
  console.log(`  📝 Extracted text saved to: ${debugPath}`);
  console.log('');

  // 2. Parse transactions
  console.log('🔍 Parsing FT entries...');
  const transactions = parseAllTransactions(fullText);

  // Also extract cash payments
  const cashPayments = extractCashPayments(fullText);
  console.log(`  Cash payments found: ${cashPayments.length}`);

  // Merge cash payments (avoid duplicates)
  const allTransactions = [...transactions];
  for (const cp of cashPayments) {
    if (!allTransactions.find(t => t.ftNumber === cp.ftNumber)) {
      allTransactions.push(cp);
    }
  }

  console.log(`  Total transactions to process: ${allTransactions.length}`);
  console.log('');

  // 3. Summary of what was parsed
  const assignedTx = allTransactions.filter(t => t.userId);
  const unassignedTx = allTransactions.filter(t => !t.userId);

  console.log('📊 Parsing Summary:');
  console.log(`  Total FT entries found: ${allTransactions.length}`);
  console.log(`  Assigned to members:    ${assignedTx.length}`);
  console.log(`  Unassigned:             ${unassignedTx.length}`);

  // Group by cycle
  const byCycle = {};
  for (const tx of assignedTx) {
    if (!byCycle[tx.cycleNumber]) byCycle[tx.cycleNumber] = [];
    byCycle[tx.cycleNumber].push(tx);
  }
  console.log('  Per cycle:');
  for (let c = 1; c <= 23; c++) {
    const count = byCycle[c] ? byCycle[c].length : 0;
    console.log(`    Cycle ${c.toString().padStart(2)}: ${count} deposits`);
  }
  console.log('');

  // 4. Create cycles in database
  console.log('🔄 Ensuring cycles exist in database...');
  const cycleMap = await ensureCyclesExist();
  console.log('');

  // 5. Insert deposits
  console.log('💰 Inserting deposits...');
  console.log('');
  const result = await insertDeposits(assignedTx, cycleMap);
  console.log('');

  // 6. Final summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 IMPORT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total FT entries parsed:   ${allTransactions.length}`);
  console.log(`  Assigned to members:       ${assignedTx.length}`);
  console.log(`  Deposits CREATED:          ${result.depositsCreated}`);
  console.log(`  Duplicates skipped:        ${result.duplicates}`);
  console.log(`  No member (skipped):       ${result.noMember}`);
  console.log(`  No cycle (skipped):        ${result.noCycle}`);
  console.log(`  Errors:                    ${result.depositsSkipped}`);
  console.log(`  Unassigned entries:        ${unassignedTx.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (unassignedTx.length > 0) {
    console.log('');
    console.log('⚠️  Unassigned FT entries (could not determine member):');
    for (const tx of unassignedTx.slice(0, 30)) {
      console.log(`  ${tx.ftNumber} | ${tx.amount || '?'} ETB | Cycle ${tx.cycleNumber || '?'} | ctx: "${tx.contextBefore?.slice(-40) || ''}"`);
    }
    if (unassignedTx.length > 30) {
      console.log(`  ... and ${unassignedTx.length - 30} more`);
    }
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log('❌ Errors:');
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  ${err.tx.ftNumber}: ${err.error}`);
    }
  }

  console.log('');
  console.log('✅ Import complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('');
    console.error('❌ Import failed:', e.message);
    console.error(e.stack);
    await prisma.$disconnect();
    process.exit(1);
  });
