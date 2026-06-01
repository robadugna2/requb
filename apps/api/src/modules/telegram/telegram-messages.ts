export class TelegramMessages {
  private static translations: Record<string, Record<string, string>> = {
    en: {
      'welcome.back': '👋 <b>Welcome back, {name}!</b>\n🇪🇹 <b>Digital Equb Platform</b>\n─────────────────────────\nManage your rotating savings, view cycles, track draw results, pay contributions, and view your profile or penalties directly from this bot.\n\n👉 <i>Select an option below to proceed:</i>',
      'welcome.new': '👋 <b>Welcome to Digital Equb!</b> 🇪🇹\n─────────────────────────\nYour Telegram ID is: <code>{telegramId}</code>\n\n⚠️ <b>Not Registered Yet</b>\nTo start participating, please contact your Equb administrator and provide them with your Telegram ID above so they can register you.\n\nOnce registered, you\'ll be able to:\n• Browse your Equb groups and cycles\n• Upload deposit receipts directly for auto-OCR reading\n• View draw results and see who won\n• Track your penalties, disputes, and reliability score',
      'group.title': '📂 <b>Group: {name}</b>\n─────────────────────────\n📝 <i>{description}</i>\n\n💰 <b>Contribution:</b> {amount}\n📅 <b>Frequency:</b> <code>{frequency}</code>\n👥 <b>Members:</b> <code>{members} / {maxMembers}</code>\n🎰 <b>Draw Method:</b> <code>{method}</code>\n📈 <b>Group Status:</b> <code>{status}</code>\n🔄 <b>Active Cycle:</b> <i>{cycle}</i>\n📊 <b>Your Shares:</b> <code>{shares} share(s)</code>\n👤 <b>Your Status:</b> <code>{memberStatus}</code>\n',
      'group.no_active_cycle': 'No active cycle',
      'group.bank_info': '🏦 <b>Bank Info:</b> {bankName} - <code>{account}</code>\n\n',
      'group.prompt_nav': '👉 <i>Use the buttons below to explore cycle history, check member rosters, view group rules, or pay your contribution:</i>',
      'rules.title': '📜 <b>Group Rules Configuration</b>\n─────────────────────────\n',
      'rules.late_rules': '⏰ <b>Late Payment Rules:</b>\n  • Penalty Type: <code>{type}</code>\n  • Penalty Amount: {penalty}\n  • Grace Period: <code>{grace} days</code>\n  • Max Missed Allowed: <code>{maxMissed} payments</code>\n\n',
      'rules.deposit_rules': '💳 <b>Deposit Rules:</b>\n  • Require Exact Amount: <code>{exact}</code>\n  • Deadline Day: <code>{deadline}</code>\n  • Verification Time: <code>~{hours} hours</code>\n\n',
      'rules.member_rules': '👥 <b>Membership Rules:</b>\n  • Require Govt ID: <code>{govtId}</code>\n  • Require Guarantor: <code>{guarantor}</code>\n  • Mid-cycle Joining: <code>{midCycle}</code>\n  • Skip Rounds Allowed: <code>{skipRound}</code>\n\n',
      'rules.gov_rules': '⚖️ <b>Governance & Payout:</b>\n  • Auto-complete: <code>{auto}</code>\n  • Post-win Contribution: <code>{postWin}</code>\n  • Payout Schedule: <code>{schedule}</code>\n  • Dispute Resolution: <code>{dispute}</code>\n\n',
      'members.list_title': '👥 <b>Group Members list</b>\n─────────────────────────\n',
      'members.empty': 'No members found.',
      'cycle.title': '🔄 <b>Cycle #{num} Information</b>\n─────────────────────────\n📅 <b>Duration:</b> <code>{duration}</code>\n⏳ <b>Status:</b> <code>{status}</code>\n💰 <b>Expected Gross Payout:</b> {payout}\n👥 <b>Total Shares Participating:</b> <code>{shares}</code>\n\n💳 <b>Deposits Submitted:</b>\n',
      'cycle.no_deposits': '  <i>No deposits submitted yet for this cycle.</i>\n',
      'cycle.winner': '\n🎉 <b>Winner Drawn:</b> <b>{winner}</b>\n',
      'dashboard.title': '📊 <b>Status Dashboard: {name}</b>\n─────────────────────────\n⭐ <b>Reliability Score:</b> <code>{score} / 100</code>\n🛡️ <i>Keep your score high by paying on time!</i>\n\n<b>Your Equb Groups Status:</b>\n\n',
      'dashboard.empty': '<i>You are not currently active in any groups.</i>',
      'dashboard.group_card': '📁 <b>Group: {name}</b>\n  • Contribution: {amount} ({frequency})\n  • Membership Status: <code>{status}</code>\n  • Current: <code>{cycle}</code>\n  • Payment Status: {payStatus}\n─────────────────────────\n',
      'dashboard.unpaid': '🚨 <b>UNPAID</b>',
      'profile.title': '👤 <b>My Profile Card</b>\n─────────────────────────\n🏷️ <b>Name:</b> <code>{name}</code>\n📞 <b>Phone:</b> <code>{phone}</code>\n🤖 <b>Telegram ID:</b> <code>{telegramId}</code>\n🇪🇹 <b>Country:</b> <code>{country}</code>\n📍 <b>Location:</b> <code>{location}</code>\n\n{emoji} <b>Reliability Score:</b> <code>{score} / 100</code>\n  └ Progress: {progress}\n\n📊 <b>Platform Activity Stats:</b>\n  • Active Groups: <code>{groups}</code>\n  • Verified Deposits: <code>{deposits}</code>\n  • Unpaid Penalties: <code>{penalties}</code>\n  • Open Disputes: <code>{disputes}</code>',
      'deposit.prompt': '💳 <b>Deposit Submission: {group}</b>\n─────────────────────────\nYou are submitting a deposit for:\n• <b>Cycle:</b> <code>#{cycle}</code>\n• <b>Required Contribution:</b> {amount}\n{bank}─────────────────────────\n\n📸 <b>Please send a photo of your bank transfer receipt.</b>\nThe system will process the transaction automatically using OCR.',
      'ocr.confirm': '📸 <b>Receipt Captured & Analyzed!</b>\n─────────────────────────\nPlease check the parsed details below before confirming:\n\n🏦 <b>Bank Name:</b> <code>{bank}</code>\n💰 <b>Amount Found:</b> {amount}\n🔢 <b>FT Reference Number:</b> <code>{ft}</code>\n📅 <b>Date:</b> <code>{date}</code>\n👤 <b>Sender Name:</b> <code>{sender}</code>\n🎯 <b>Confidence Score:</b> <code>{confidence}%</code>\n\n⚠️ <b>Note:</b> Confirming will submit this receipt to the administrator for final verification. Make sure the FT number is readable.',
      'lottery.title': '🎉 <b>Lottery Results & Rotations: {group}</b>\n─────────────────────────\n🎰 <b>Current Drawing Cycle:</b> <code>Cycle #{cycle}</code>\n⏳ <b>Status:</b> <code>{status}</code>\n\n<b>Previous Winners / Rotation History:</b>\n',
      'lottery.empty': '  <i>No winners drawn yet in this group.</i>\n',
      'penalty.title': '⚠️ <b>My Active & Past Penalties</b>\n─────────────────────────\n<i>List of penalties issued:</i>\n\n',
      'penalty.empty': '🟢 You have no penalty records. Great job!',
      'penalty.detail': '⚠️ <b>Penalty Record Details</b>\n─────────────────────────\n📂 <b>Group:</b> <code>{group}</code>\n🔢 <b>Cycle:</b> <code>{cycle}</code>\n💰 <b>Amount:</b> {amount}\n📝 <b>Reason:</b> <code>{reason}</code>\n⏳ <b>Status:</b> {emoji} <code>{status}</code>\n📅 <b>Issued On:</b> <code>{issued}</code>\n{paid}{notes}',
      'dispute.title': '⚖️ <b>My Filed Disputes</b>\n─────────────────────────\n',
      'dispute.empty': 'No disputes filed by or against you.',
      'help.title': '🆘 <b>Digital Equb - Bot Help & Guidelines</b>\n─────────────────────────\nWelcome to the Digital Equb Member Assistant Bot. Here is how you can use this bot:\n\n💡 <b>Available Commands:</b>\n• /start - Launch the main menu card\n• /menu - Navigate to key shortcuts directly\n• /groups - Browse your participating Equb groups\n• /status - Access your payment status dashboard\n• /profile - Check reliability score and account info\n• /help - Open this help documentation\n\n🏦 <b>How to Submit a Deposit:</b>\n1. Navigate to <b>Submit Deposit</b> or click <b>Pay for Cycle</b> in your group.\n2. The bot will prompt you to upload your receipt.\n3. Send the receipt image. The OCR reader will automatically parse the FT number, amount, bank, and date.\n4. Verify the details in the confirmation message and press <b>Confirm Submission</b>.\n5. Once confirmed, the group administrator will review and verify your deposit. You\'ll receive a Telegram notification when it\'s verified!\n\n🛡️ <b>Reliability Score Policy:</b>\nYour score starts at 100. Late submissions or unpaid penalties deduct points, while consistent on-time payments give bonuses. Maintain a high score to prevent membership suspension!',
      'btn.groups': '📋 My Groups',
      'btn.status': '📊 Status Dashboard',
      'btn.pay': '💳 Submit Deposit',
      'btn.lottery': '🎉 Lottery & Winners',
      'btn.penalties': '⚠️ Penalties',
      'btn.disputes': '⚖️ Disputes',
      'btn.profile': '👤 Profile & Score',
      'btn.language': '🌐 Language / ቋንቋ',
      'btn.notifications': '🔔 Notifications',
      'btn.help': '🆘 Help & Guidelines',
      'btn.back_menu': '🔙 Back to Menu',
      'btn.back_groups': '🔙 Back to Groups',
      'btn.back_group': '🔙 Back to Group',
      'btn.back_disputes': '🔙 Back to Disputes',
      'btn.back_penalties': '🔙 Back to Penalties',
      'btn.active_cycle': '🔄 Active Cycle Info',
      'btn.members': '👥 Group Members',
      'btn.rules': '📜 Group Rules',
      'btn.pay_cycle': '💳 Pay for Cycle',
    },
    am: {
      'welcome.back': '👋 <b>እንኳን ደህና መጡ፣ {name}!</b>\n🇪🇹 <b>የዲጂታል እቁብ መድረክ</b>\n─────────────────────────\nየቁጠባ እቁብዎን ያስተዳድሩ፣ ዑደቶችን ይመልከቱ፣ የዕጣ ውጤቶችን ይከታተሉ፣ መዋጮዎችን ይክፈሉ፣ እና መገለጫዎን ወይም ቅጣቶችን በቀጥታ ከዚህ ቦት ይመልከቱ።\n\n👉 <i>ለመቀጠል ከታች ካሉት አማራጮች አንዱን ይምረጡ፡</i>',
      'welcome.new': '👋 <b>ወደ ዲጂታል እቁብ በደህና መጡ!</b> 🇪🇹\n─────────────────────────\nየእርስዎ ቴሌግራም መለያ ቁጥር (ID)፦ <code>{telegramId}</code>\n\n⚠️ <b>እስካሁን አልተመዘገቡም</b>\nእባክዎ እቁብ መሳተፍ ለመጀመር የአስተዳዳሪዎን ያነጋግሩና ከላይ ያለውን የቴሌግራም መለያ ቁጥር በመስጠት እንዲያስመዘግቡዎት ያድርጉ።\n\nአንዴ ሲመዘገቡ የሚከተሉትን ማድረግ ይችላሉ፦\n• የእቁብ ቡድኖችዎን እና ዑደቶችዎን ማየት\n• ደረሰኞችን በቀጥታ በመላክ በOCR እንዲነበብ ማድረግ\n• የዕጣ ውጤቶችን እና አሸናፊዎችን መመልከት\n• ቅጣቶችን፣ ክርክሮችን እና የታማኝነት ነጥብዎን መከታተል',
      'group.title': '📂 <b>እቁብ ቡድን፦ {name}</b>\n─────────────────────────\n📝 <i>{description}</i>\n\n💰 <b>መዋጮ፦</b> {amount}\n📅 <b>የክፍያ ድግግሞሽ፦</b> <code>{frequency}</code>\n👥 <b>አባላት፦</b> <code>{members} / {maxMembers}</code>\n🎰 <b>የዕጣ ዘዴ፦</b> <code>{method}</code>\n📈 <b>የቡድን ሁኔታ፦</b> <code>{status}</code>\n🔄 <b>ንቁ ዑደት፦</b> <i>{cycle}</i>\n📊 <b>የእርስዎ ዕጣ ድርሻ፦</b> <code>{shares} እጣ</code>\n👤 <b>የእርስዎ ሁኔታ፦</b> <code>{memberStatus}</code>\n',
      'group.no_active_cycle': 'ንቁ ዑደት የለም',
      'group.bank_info': '🏦 <b>የባንክ መረጃ፦</b> {bankName} - <code>{account}</code>\n\n',
      'group.prompt_nav': '👉 <i>ዑደቶችን፣ የአባላት ዝርዝርን፣ ደንቦችን ለማየት ወይም መዋጮ ለመክፈል ከታች ያሉትን ቁልፎች ይጠቀሙ፦</i>',
      'rules.title': '📜 <b>የእቁብ ቡድን ደንቦች ቅንብር</b>\n─────────────────────────\n',
      'rules.late_rules': '⏰ <b>የዘግይቶ መክፈያ ደንቦች፦</b>\n  • የቅጣት አይነት፦ <code>{type}</code>\n  • የቅጣት መጠን፦ {penalty}\n  • የፈቃድ ቀናት (Grace Period)፦ <code>{grace} ቀናት</code>\n  • የሚፈቀደው ከፍተኛው የዘለሉት ክፍያ፦ <code>{maxMissed} ክፍያዎች</code>\n\n',
      'rules.deposit_rules': '💳 <b>የክፍያ ደንቦች፦</b>\n  • ልክ እኩል መጠን መክፈል፦ <code>{exact}</code>\n  • የመጨረሻ የመክፈያ ቀን፦ <code>{deadline}</code>\n  • የማረጋገጫ ጊዜ፦ <code>~{hours} ሰዓታት</code>\n\n',
      'rules.member_rules': '👥 <b>የአባልነት ደንቦች፦</b>\n  • የመንግስት መታወቂያ ይፈልጋል፦ <code>{govtId}</code>\n  • ዋስ ይፈልጋል፦ <code>{guarantor}</code>\n  • በዑደት መሃል መቀላቀል፦ <code>{midCycle}</code>\n  • ዙር መዝለል ይፈቀዳል፦ <code>{skipRound}</code>\n\n',
      'rules.gov_rules': '⚖️ <b>አስተዳደር እና ክፍያ፦</b>\n  • ራስ-አጠናቅቅ፦ <code>{auto}</code>\n  • ከድል በኋላ ክፍያ ይቀጥላል፦ <code>{postWin}</code>\n  • የክፍያ መርሃ-ግብር፦ <code>{schedule}</code>\n  • የክርክር አፈታት፦ <code>{dispute}</code>\n\n',
      'members.list_title': '👥 <b>የእቁብ ቡድን አባላት ዝርዝር</b>\n─────────────────────────\n',
      'members.empty': 'ምንም አባላት አልተገኙም።',
      'cycle.title': '🔄 <b>የዑደት #{num} መረጃ</b>\n─────────────────────────\n📅 <b>የቆይታ ጊዜ፦</b> <code>{duration}</code>\n⏳ <b>ሁኔታ፦</b> <code>{status}</code>\n💰 <b>የሚጠበቀው አጠቃላይ ክፍያ፦</b> {payout}\n👥 <b>የሚሳተፉ ጠቅላላ ዕጣዎች፦</b> <code>{shares}</code>\n\n💳 <b>የገቡ ደረሰኞች፦</b>\n',
      'cycle.no_deposits': '  <i>ለዚህ ዑደት እስካሁን የገባ ደረሰኝ የለም።</i>\n',
      'cycle.winner': '\n🎉 <b>አሸናፊ ዕጣ፦</b> <b>{winner}</b>\n',
      'dashboard.title': '📊 <b>የክፍያ ሁኔታ ሰሌዳ፦ {name}</b>\n─────────────────────────\n⭐ <b>የታማኝነት ነጥብ፦</b> <code>{score} / 100</code>\n🛡️ <i>በሰዓቱ በመክፈል ነጥብዎን ከፍ ያድርጉ!</i>\n\n<b>የእርስዎ ቡድኖች ሁኔታ፦</b>\n\n',
      'dashboard.empty': '<i>በማንኛውም እቁብ ቡድን ውስጥ ንቁ ተሳታፊ አይደሉም።</i>',
      'dashboard.group_card': '📁 <b>እቁብ፦ {name}</b>\n  • መዋጮ፦ {amount} ({frequency})\n  • የአባልነት ሁኔታ፦ <code>{status}</code>\n  • የአሁኑ ዑደት፦ <code>{cycle}</code>\n  • የክፍያ ሁኔታ፦ {payStatus}\n─────────────────────────\n',
      'dashboard.unpaid': '🚨 <b>አልተከፈለም</b>',
      'profile.title': '👤 <b>የእኔ መገለጫ መረጃ</b>\n─────────────────────────\n🏷️ <b>ስም፦</b> <code>{name}</code>\n📞 <b>ስልክ፦</b> <code>{phone}</code>\n🤖 <b>ቴሌግራም መለያ፦</b> <code>{telegramId}</code>\n🇪🇹 <b>ሀገር፦</b> <code>{country}</code>\n📍 <b>አድራሻ፦</b> <code>{location}</code>\n\n{emoji} <b>የታማኝነት ነጥብ፦</b> <code>{score} / 100</code>\n  └ ደረጃ፦ {progress}\n\n📊 <b>የእንቅስቃሴ ስታቲስቲክስ፦</b>\n  • ንቁ ቡድኖች፦ <code>{groups}</code>\n  • የተረጋገጡ ክፍያዎች፦ <code>{deposits}</code>\n  • ያልተከፈሉ ቅጣቶች፦ <code>{penalties}</code>\n  • ክፍት ክርክሮች፦ <code>{disputes}</code>',
      'deposit.prompt': '💳 <b>የክፍያ ማስረከቢያ፦ {group}</b>\n─────────────────────────\nየሚከፍሉበት ዑደት መረጃ፦\n• <b>ዑደት፦</b> <code>#{cycle}</code>\n• <b>የሚፈለገው መዋጮ፦</b> {amount}\n{bank}─────────────────────────\n\n📸 <b>እባክዎ የባንክ ማስተላለፊያ ደረሰኝ ፎቶ ይላኩ።</b>\nሲስተሙ ፎቶውን በOCR በራስ-ሰር ያነባል።',
      'ocr.confirm': '📸 <b>ደረሰኙ ተነቧል እና ተመርምሯል!</b>\n─────────────────────────\nእባክዎ ከማረጋገጥዎ በፊት ከታች ያሉትን ዝርዝሮች ያረጋግጡ፦\n\n🏦 <b>የባንክ ስም፦</b> <code>{bank}</code>\n💰 <b>የተገኘው ገንዘብ፦</b> {amount}\n🔢 <b>የማስተላለፊያ ቁጥር (FT)፦</b> <code>{ft}</code>\n📅 <b>ቀን፦</b> <code>{date}</code>\n👤 <b>ላኪ ስም፦</b> <code>{sender}</code>\n🎯 <b>የመነበብ ትክክለኛነት፦</b> <code>{confidence}%</code>\n\n⚠️ <b>ማስታወሻ፦</b> ይህንን ሲያረጋግጡ ደረሰኙ ለአስተዳዳሪው ይላካል። የFT ቁጥሩ በደንብ የሚነበብ መሆኑን ያረጋግጡ።',
      'lottery.title': '🎉 <b>የዕጣ ውጤቶች እና ታሪክ፦ {group}</b>\n─────────────────────────\n🎰 <b>የአሁኑ የዕጣ ዑደት፦</b> <code>ዑደት #{cycle}</code>\n⏳ <b>ሁኔታ፦</b> <code>{status}</code>\n\n<b>ቀደምት አሸናፊዎች ታሪክ፦</b>\n',
      'lottery.empty': '  <i>ለዚህ ቡድን እስካሁን የወጣ እጣ የለም።</i>\n',
      'penalty.title': '⚠️ <b>የእኔ ንቁ እና ያለፉ ቅጣቶች</b>\n─────────────────────────\n<i>የተጣሉ ቅጣቶች ዝርዝር፦</i>\n\n',
      'penalty.empty': '🟢 ምንም የተቀመጠ ቅጣት የለብዎትም። በጣም ጥሩ!',
      'penalty.detail': '⚠️ <b>የቅጣት ዝርዝር መረጃ</b>\n─────────────────────────\n📂 <b>ቡድን፦</b> <code>{group}</code>\n🔢 <b>ዑደት፦</b> <code>{cycle}</code>\n💰 <b>መጠን፦</b> {amount}\n📝 <b>ምክንያት፦</b> <code>{reason}</code>\n⏳ <b>ሁኔታ፦</b> {emoji} <code>{status}</code>\n📅 <b>የተጣለበት ቀን፦</b> <code>{issued}</code>\n{paid}{notes}',
      'dispute.title': '⚖️ <b>የእኔ ክርክሮች</b>\n─────────────────────────\n',
      'dispute.empty': 'በእርስዎ የተመዘገበ ወይም በእርስዎ ላይ የቀረበ ክርክር የለም።',
      'help.title': '🆘 <b>የዲጂታል እቁብ - የእርዳታ መመሪያ</b>\n─────────────────────────\nእንኳን ወደ ዲጂታል እቁብ አጋዥ ቦት በደህና መጡ። ቦቱን ለመጠቀም የሚከተሉትን ይከተሉ፦\n\n💡 <b>ትዕዛዞች፦</b>\n• /start - ዋናውን ማውጫ ይከፍታል\n• /menu - ፈጣን አቋራጭ ማውጫን ያሳያል\n• /groups - የእርስዎን እቁቦች ያሳያል\n• /status - የእርስዎን የክፍያ ሁኔታ ያሳያል\n• /profile - የታማኝነት ነጥብ እና መገለጫ ያሳያል\n• /help - ይህንን የእርዳታ ገጽ ይከፍታል\n\n🏦 <b>ደረሰኝ እንዴት እንደሚላክ፦</b>\n1. <b>Submit Deposit</b> ወይም <b>Pay for Cycle</b> የሚለውን ይጫኑ።\n2. ቦቱ የደረሰኝ ፎቶ እንዲልኩ ይጠይቅዎታል።\n3. የደረሰኙን ፎቶ ይላኩ። OCR የFT ቁጥር፣ መጠን እና ባንክ ያነባል።\n4. ዝርዝሩን አረጋግጠው <b>Confirm Submission</b> ይጫኑ።\n5. አስተዳዳሪው ደረሰኙን ሲያረጋግጥ በቴሌግራም መልዕክት ይደርስዎታል!',
      'btn.groups': '📋 የእኔ እቁቦች',
      'btn.status': '📊 የክፍያ ሁኔታ ሰሌዳ',
      'btn.pay': '💳 መዋጮ አስገባ',
      'btn.lottery': '🎉 የዕጣ ውጤቶች',
      'btn.penalties': '⚠️ ቅጣቶች',
      'btn.disputes': '⚖️ ክርክሮች',
      'btn.profile': '👤 መገለጫዬ እና ውጤት',
      'btn.language': '🌐 ቋንቋ / Language',
      'btn.notifications': '🔔 ማሳወቂያዎች',
      'btn.help': '🆘 እርዳታ እና መመሪያ',
      'btn.back_menu': '🔙 ወደ ዋናው ማውጫ',
      'btn.back_groups': '🔙 ወደ እቁቦች',
      'btn.back_group': '🔙 ወደ እቁቡ ይመለሱ',
      'btn.back_disputes': '🔙 ወደ ክርክሮች ይመለሱ',
      'btn.back_penalties': '🔙 ወደ ቅጣቶች ይመለሱ',
      'btn.active_cycle': '🔄 የንቁ ዑደት መረጃ',
      'btn.members': '👥 የቡድኑ አባላት',
      'btn.rules': '📜 የቡድኑ ደንቦች',
      'btn.pay_cycle': '💳 ለዑደት ክፈል',
    },
    om: {
      'welcome.back': '👋 <b>Baga nagaan deebitan, {name}!</b>\n🇪🇹 <b>Platform Equb Diijitaalaa</b>\n─────────────────────────\nQusannoo equb keessanii bulchaa, carraawwan hordofaa fi kaffaltii keessan kallattiin bot kana irraa raawwadhaa.\n\n👉 <i>Filannoofi dhimma barbaaddan asii gadii filadhaa:</i>',
      'welcome.new': '👋 <b>Gara Equb Diijitaalaatti Baga Nagaan Dhuftan!</b> 🇪🇹\n─────────────────────────\nTelegram ID keessan: <code>{telegramId}</code>\n\n⚠️ <b>Hanga Ammaatti Hin Galmoofne</b>\nQooda fudhachuu jalqabuuf, maaloo kaffaltii raawwachuun dura bulchaa equb keessanii qunnamaa Telegram ID keessan kennuun akka isin galmeessan taasisasa.\n\nErga galmooftanii booda:\n• Gareewwan equb keessanii fi kaffaltii ilaaluu\n• Nagaheewwan keessan kallattiin erguun akka OCR dubbisu gochuu\n• Bu\'aa carraawwanii fi namoota mo\'atan ilaaluu\n• Adabbii fi qabxii amanamummaa keessanii hordofuu',
      'group.title': '📂 <b>Garee Equb: {name}</b>\n─────────────────────────\n📝 <i>{description}</i>\n\n💰 <b>Kaffaltii:</b> {amount}\n📅 <b>Yeroo:</b> <code>{frequency}</code>\n👥 <b>Miseensota:</b> <code>{members} / {maxMembers}</code>\n🎰 <b>Adeemsa Carraa:</b> <code>{method}</code>\n📈 <b>Haala Garee:</b> <code>{status}</code>\n🔄 <b>Kaffaltii Ammaa:</b> <i>{cycle}</i>\n📊 <b>Qooda keessan:</b> <code>{shares} share(s)</code>\n👤 <b>Haala keessan:</b> <code>{memberStatus}</code>\n',
      'group.no_active_cycle': 'Carraan hojii irra jiru hin jiru',
      'group.bank_info': '🏦 <b>Oduu Baankii:</b> {bankName} - <code>{account}</code>\n\n',
      'group.prompt_nav': '👉 <i>Miseensota, seera garee fi kaffaltii raawwachuuf asii gaditti filadhaa:</i>',
      'rules.title': '📜 <b>Gareen Seera Isaanii</b>\n─────────────────────────\n',
      'rules.late_rules': '⏰ <b>Seera Kaffaltii Booddeef:</b>\n  • Gosa Adabbii: <code>{type}</code>\n  • Hamma Adabbii: {penalty}\n  • Guyyoota Dhaabbataa: <code>{grace} guyyaa</code>\n  • Max Hanga Hafu Danda\'u: <code>{maxMissed} kaffaltii</code>\n\n',
      'rules.deposit_rules': '💳 <b>Seera Nagahee:</b>\n  • Hamma kaffaltii sirrii: <code>{exact}</code>\n  • Guyyaa Xumuraa: <code>{deadline}</code>\n  • Yeroo Mirkaneessuu: <code>~{hours} sa\'aatii</code>\n\n',
      'rules.member_rules': '👥 <b>Seera Miseensummaa:</b>\n  • ID Mootummaa: <code>{govtId}</code>\n  • Waabii: <code>{guarantor}</code>\n  • Gidduutti Makamuu: <code>{midCycle}</code>\n  • Guyyaa Dabarsuu: <code>{skipRound}</code>\n\n',
      'rules.gov_rules': '⚖️ <b>Bulchiinsaa fi Kaffaltii:</b>\n  • Auto-Xumuri: <code>{auto}</code>\n  • Mo\'achuun booda kaffaltii: <code>{postWin}</code>\n  • Guyyaa kaffaltii carraa: <code>{schedule}</code>\n  • Furmaata Waldhabdee: <code>{dispute}</code>\n\n',
      'members.list_title': '👥 <b>Miseensota Garee</b>\n─────────────────────────\n',
      'members.empty': 'Miseensi hin argamne.',
      'cycle.title': '🔄 <b>Kaffaltii Adeemsa #{num} Oduu</b>\n─────────────────────────\n📅 <b>Yeroo:</b> <code>{duration}</code>\n⏳ <b>Haala:</b> <code>{status}</code>\n💰 <b>Kaffaltii Waliigala Eegamu:</b> {payout}\n👥 <b>Qooda Waliigalaa:</b> <code>{shares}</code>\n\n💳 <b>Nagaheewwan Dhihaatan:</b>\n',
      'cycle.no_deposits': '  <i>Nagaheen dhihaate hin jiru.</i>\n',
      'cycle.winner': '\n🎉 <b>Kan Carraan Baheef:</b> <b>{winner}</b>\n',
      'dashboard.title': '📊 <b>Daashboordii Haala Kaffaltii: {name}</b>\n─────────────────────────\n⭐ <b>Qabxii Amanamummaa:</b> <code>{score} / 100</code>\n🛡️ <i>Kaffaltii yeroon raawwachuun qabxii keessan eeggadhaa!</i>\n\n<b>Gareewwan Equb keessanii:</b>\n\n',
      'dashboard.empty': '<i>Garee equb tokko keessattuu miseensa hin taane.</i>',
      'dashboard.group_card': '📁 <b>Garee: {name}</b>\n  • Kaffaltii: {amount} ({frequency})\n  • Haala Miseensummaa: <code>{status}</code>\n  • Carraa Ammaa: <code>{cycle}</code>\n  • Haala Kaffaltii: {payStatus}\n─────────────────────────\n',
      'dashboard.unpaid': '🚨  <b>KAN HIN KAFFALAMNE</b>',
      'profile.title': '👤 <b>Kaardii Eenyummaa Kiyya</b>\n─────────────────────────\n🏷️ <b>Maqaa:</b> <code>{name}</code>\n📞 <b>Bilbila:</b> <code>{phone}</code>\n🤖 <b>Telegram ID:</b> <code>{telegramId}</code>\n🇪🇹 <b>Biyya:</b> <code>{country}</code>\n📍 <b>Bakka Jireenyaa:</b> <code>{location}</code>\n\n{emoji} <b>Qabxii Amanamummaa:</b> <code>{score} / 100</code>\n  └ Progress: {progress}\n\n📊 <b>Hojiiwwan Platform Keessatti:</b>\n  • Gareewwan Hojii Irra Jiran: <code>{groups}</code>\n  • Nagaheewwan Mirkanaa\'an: <code>{deposits}</code>\n  • Adabbii Hin Kaffalamne: <code>{penalties}</code>\n  • Waldhabdee Banaman: <code>{disputes}</code>',
      'deposit.prompt': '💳 <b>Kaffaltii Erguu: {group}</b>\n─────────────────────────\nKaffaltii kanaaf raawwattu:\n• <b>Kaffaltii Carraa:</b> <code>#{cycle}</code>\n• <b>Kaffaltii Gariidhaa:</b> {amount}\n{bank}─────────────────────────\n\n📸 <b>Maaloo nagahee kaffaltii baankii 📸 ergaa.</b>\nSistemichi nagahecha dubbisa.',
      'ocr.confirm': '📸 <b>Nagaheen Captured Dubbisameera!</b>\n─────────────────────────\nMaaloo dhimmoota asii gadii mirkaneessuu keessaniin dura hordofaa:\n\n🏦 <b>Maqaa Baankii:</b> <code>{bank}</code>\n💰 <b>Hamma Maallaqaa:</b> {amount}\n🔢 <b>Lakk FT:</b> <code>{ft}</code>\n📅 <b>Guyyaa:</b> <code>{date}</code>\n👤 <b>Maqaa Ergaa:</b> <code>{sender}</code>\n🎯 <b>Confidence Score:</b> <code>{confidence}%</code>\n\n⚠️ <b>Hubachiisa:</b> Mirkaneessuun nagahee kana gara bulchaa equbtti erga. Lakk FT dubbisamuu isaa ilaalaa.',
      'lottery.title': '🎉 <b>Bu\'aa Carraa garee: {group}</b>\n─────────────────────────\n🎰 <b>Adeemsa Carraa Ammaa:</b> <code>Adeemsa #{cycle}</code>\n⏳ <b>Haala:</b> <code>{status}</code>\n\n<b>Seenaa Namoota Mo\'atanii:</b>\n',
      'lottery.empty': '  <i>Garee kana keessatti carraan hin baane.</i>\n',
      'penalty.title': '⚠️ <b>Adabbiiwwan Kiyya</b>\n─────────────────────────\n<i>Adabbii kaffaltii booddee:</i>\n\n',
      'penalty.empty': '🟢 Adabbiin galmaa\'e hin jiru. Gaariidha!',
      'penalty.detail': '⚠️ <b>Ragaa Adabbii</b>\n─────────────────────────\n📂 <b>Garee:</b> <code>{group}</code>\n🔢 <b>Carraa:</b> <code>{cycle}</code>\n💰 <b>Hamma:</b> {amount}\n📝 <b>Sababa:</b> <code>{reason}</code>\n⏳ <b>Haala:</b> {emoji} <code>{status}</code>\n📅 <b>Guyyaa Adabbii:</b> <code>{issued}</code>\n{paid}{notes}',
      'dispute.title': '⚖️ <b>Waldhabdeewwan Kiyya</b>\n─────────────────────────\n',
      'dispute.empty': 'Waldhabdeen keessan galmaa\'e hin jiru.',
      'help.title': '🆘 <b>Gargaarsa Equb Diijitaalaa</b>\n─────────────────────────\nBaga gara bot gargaarsa equb diijitaalaatti nagaan dhuftan:\n\n💡 <b>Hojiiwwan Bot:</b>\n• /start - Gara menu gariitti deebisa\n• /menu - Menu saffisaa fida\n• /groups - Gareewwan equb ilaaluuf\n• /status - Haala kaffaltii ilaaluuf\n• /profile - Qabxii fi eenyummaa ilaaluuf\n• /help - Gargaarsa kana fida',
      'btn.groups': '📋 Gareewwan Kiyya',
      'btn.status': '📊 Haala Kaffaltii',
      'btn.pay': '💳 Kaffaltii Ergi',
      'btn.lottery': '🎉 Bu\'aa Carraa',
      'btn.penalties': '⚠️ Adabbiiwwan',
      'btn.disputes': '⚖️ Waldhabdee',
      'btn.profile': '👤 Eenyummaa Kiyya',
      'btn.language': '🌐 Afaan / Language',
      'btn.notifications': '🔔 Beeksisa',
      'btn.help': '🆘 Gargaarsa',
      'btn.back_menu': '🔙 Gara Menutti',
      'btn.back_groups': '🔙 Gara Gareewwanii',
      'btn.back_group': '🔙 Gara Gareetti',
      'btn.back_disputes': '🔙 Gara Waldhabdeetti',
      'btn.back_penalties': '🔙 Gara Adabbiitti',
      'btn.active_cycle': '🔄 Oduu Kaffaltii Ammaa',
      'btn.members': '👥 Miseensota Garee',
      'btn.rules': '📜 Seera Garee',
      'btn.pay_cycle': '💳 Kaffaltii Raawwadhu',
    },
    ti: {
      'welcome.back': '👋 <b>እንኳዕ ብደሓን መጻእኩም፣ {name}!</b>\n🇪🇹 <b>ናይ ዲጂታል እቁብ መድረኽ</b>\n─────────────────────────\nናይ እቁብ ንጥፈታትኩም ይምሓድሩ፣ ዑደታት ይርኣዩ፣ ውጽኢት ዕጫታት ይከታተሉ፣ ክፍሊታት ይፈጽሙ፣ ከምኡውን መገለጺኹም ወይ ቅንዓትኩም ብቀጥታ ካብዚ ቦት ይርኣዩ።\n\n👉 <i>ንቕድሚት ንምስጓም ካብዚ ታሕቲ ዘሎ አማራጺ ይምረጹ፡</i>',
      'welcome.new': '👋 <b>ናብ ዲጂታል እቁብ ብደሓን መጻእኩም!</b> 🇪🇹\n─────────────────────────\nናይ ቴሌግራም መለለዪ ቁጽሪ (ID)፦ <code>{telegramId}</code>\n\n⚠️ <b>እስካብ ሕጂ ኣይተመዝገብኩምን</b>\nእባክኹም እቁብ ንምስታፍ ናይ እቁብኩም አስተዳዳሪ ብምርካብ ናይ ቴሌግራም መለለዪ ቁጽሪ ብምሃብ ከምዝምዝግብኹም ግበሩ።\n\nምስ ተመዝገብኩም እዞም ዝስዕቡ ክትገብሩ ትኽእሉ እኩም፦\n• ናይ እቁብ ጉጅለታትኩምን ዑደታትኩምን ምርኣይ\n• ደረሰኝ ብቀጥታ ብምስዳድ ብOCR ከምዝንበብ ምግባር\n• ውጽኢት ዕጫታትን ተዓወትትን መመልከቲ\n• ቅላዕ፣ ክርክራትን ናይ ታማኝነት ነጥብታትን ምክትታል',
      'group.title': '📂 <b>ናይ እቁብ ጉጅለ፦ {name}</b>\n─────────────────────────\n📝 <i>{description}</i>\n\n💰 <b>ክፍሊት መዋጮ፦</b> {amount}\n📅 <b>ድግግሞሽ ክፍሊት፦</b> <code>{frequency}</code>\n👥 <b>ኣባላት፦</b> <code>{members} / {maxMembers}</code>\n🎰 <b>ናይ ዕጫ ኣገባብ፦</b> <code>{method}</code>\n📈 <b>ናይ ጉጅለ ኩነታት፦</b> <code>{status}</code>\n🔄 <b>ንጡፍ ዑደት፦</b> <i>{cycle}</i>\n📊 <b>ድርሻኹም፦</b> <code>{shares} ዕጫ</code>\n👤 <b>ናይ ባዕልኹም ኩነታት፦</b> <code>{memberStatus}</code>\n',
      'group.no_active_cycle': 'ንጡፍ ዑደት የለን',
      'group.bank_info': '🏦 <b>ናይ ባንክ ሓበሬታ፦</b> {bankName} - <code>{account}</code>\n\n',
      'group.prompt_nav': '👉 <i>ዑደታት፣ ኣባላት፣ ደንብታት ንምርኣይ ወይ ክፍሊት ንምፍጻም ካብ ታሕቲ ዘሎ ቁልፊታት ይምረጹ፦</i>',
      'rules.title': '📜 <b>ናይ እቁብ ጉጅለ ደንብታት ቅንብር</b>\n─────────────────────────\n',
      'rules.late_rules': '⏰ <b>ናይ ደንጊኻ ክፍሊት ደንብታት፦</b>\n  • ናይ ቅላዕ ዓይነት፦ <code>{type}</code>\n  • መጠን ቅላዕ፦ {penalty}\n  • ናይ ምሕረት መዓልታት፦ <code>{grace} መዓልታት</code>\n  • ዝለዓለ ዝተዘለለ ክፍሊት፦ <code>{maxMissed} ክፍሊታት</code>\n\n',
      'rules.deposit_rules': '💳 <b>ናይ ክፍሊት ደንብታት፦</b>\n  • ልክዕ ዝኾነ መጠን ክፍሊት፦ <code>{exact}</code>\n  • ናይ መወዳእታ ክፍሊት መዓልቲ፦ <code>{deadline}</code>\n  • ናይ ምርግጋጽ ግዜ፦ <code>~{hours} ሰዓታት</code>\n\n',
      'rules.member_rules': '👥 <b>ናይ ኣባልነት ደንብታት፦</b>\n  • መታወቂያ መንግስቲ የድሊ፦ <code>{govtId}</code>\n  • ዋስትና የድሊ፦ <code>{guarantor}</code>\n  • ኣብ ማእከል ዑደት ምጽንባር፦ <code>{midCycle}</code>\n  • ዙር ምስጋር ይፍቀድ፦ <code>{skipRound}</code>\n\n',
      'rules.gov_rules': '⚖️ <b>ምሕደራን ክፍሊትን፦</b>\n  • ብባዕሉ ዝውዳእ፦ <code>{auto}</code>\n  • ድሕሪ ምዕዋት ክፍሊት ይቀጽል፦ <code>{postWin}</code>\n  • ናይ ክፍሊት ዕጫ መርሃ-ግብር፦ <code>{schedule}</code>\n  • ኣፈታትሓ ክርክር፦ <code>{dispute}</code>\n\n',
      'members.list_title': '👥 <b>ናይ እቁብ ጉጅለ አባላት ዝርዝር</b>\n─────────────────────────\n',
      'members.empty': 'ዝተረኸቡ አባላት የለዉን።',
      'cycle.title': '🔄 <b>ናይ ዑደት #{num} ሓበሬታ</b>\n─────────────────────────\n📅 <b>ናይ ግዜ ቆጸራ፦</b> <code>{duration}</code>\n⏳ <b>ኩነታት፦</b> <code>{status}</code>\n💰 <b>ዝጽበ አጠቃላይ ክፍሊት፦</b> {payout}\n👥 <b>ዝሳተፉ አጠቃላይ ዕጫታት፦</b> <code>{shares}</code>\n\n💳 <b>ዝኣተዉ ደረሰኛታት፦</b>\n',
      'cycle.no_deposits': '  <i>ንእዚ ዑደት ክሳብ ሕጂ ዝኣተወ ደረሰኝ የለን።</i>\n',
      'cycle.winner': '\n🎉 <b>ዕጫ ዝበጽሖ ኣባል፦</b> <b>{winner}</b>\n',
      'dashboard.title': '📊 <b>ናይ ክፍሊት ኩነታት ሰሌዳ፦ {name}</b>\n─────────────────────────\n⭐ <b>ታማኝነት ነጥቢ፦</b> <code>{score} / 100</code>\n🛡️ <i>ብእዋኑ ብምኽፋል ነጥብኹም የዕብዩ!</i>\n\n<b>ናይ ባዕልኹም ጉጅለታት ኩነታት፦</b>\n\n',
      'dashboard.empty': '<i>አብ ምንም እቁብ ጉጅለ ንጡፍ አባል አይኮኑን።</i>',
      'dashboard.group_card': '📁 <b>እቁብ፦ {name}</b>\n  • መዋጮ፦ {amount} ({frequency})\n  • ናይ ኣባልነት ኩነታት፦ <code>{status}</code>\n  • ናይ ሕጂ ዑደት፦ <code>{cycle}</code>\n  • ክፍሊት ኩነታት፦ {payStatus}\n─────────────────────────\n',
      'dashboard.unpaid': '🚨 <b>ኣይተኸፈለን</b>',
      'profile.title': '👤 <b>ናይ መገለጺ ሓበሬታይ</b>\n─────────────────────────\n🏷️ <b>ስም፦</b> <code>{name}</code>\n📞 <b>ስልኪ፦</b> <code>{phone}</code>\n🤖 <b>ቴሌግራም መለለዪ፦</b> <code>{telegramId}</code>\n🇪🇹 <b>ዓዲ፦</b> <code>{country}</code>\n📍 <b>ኣድራሻ፦</b> <code>{location}</code>\n\n{emoji} <b>ናይ ታማኝነት ነጥቢ፦</b> <code>{score} / 100</code>\n  └ ደረጃ፦ {progress}\n\n📊 <b>ናይ ንጥፈታት ስታቲስቲክስ፦</b>\n  • ንጡፋት ጉጅለታት፦ <code>{groups}</code>\n  • ዝተረጋገጹ ክፍሊታት፦ <code>{deposits}</code>\n  • ዘይተኸፈሉ ቅላዕታት፦ <code>{penalties}</code>\n  • ዘይተዓጽዉ ክርክራት፦ <code>{disputes}</code>',
      'deposit.prompt': '💳 <b>ናይ ክፍሊት ደረሰኝ ምእታው፦ {group}</b>\n─────────────────────────\nክፍሊት ዝፍጸመሉ ዑደት ሓበሬታ፦\n• <b>ዑደት፦</b> <code>#{cycle}</code>\n• <b>መዋጮ፦</b> {amount}\n{bank}─────────────────────────\n\n📸 <b>እባክኹም ናይ ክፍሊት ደረሰኝ ፎቶ ስደዱ።</b>\nሲስተም ብባዕሉ ብOCR ከንብቦ እዩ።',
      'ocr.confirm': '📸 <b>ደረሰኝ ተነቢቡን ተፈቲሹን እዩ!</b>\n─────────────────────────\nእባክኹም ቅድሚ ምርግጋጽኩም ታሕቲ ዘሎ ሓበሬታታት ፈትሹ፦\n\n🏦 <b>ናይ ባንክ ስም፦</b> <code>{bank}</code>\n💰 <b>ዝተረኽበ ገንዘብ፦</b> {amount}\n🔢 <b>ናይ መተሓላለፊ ቁጽሪ (FT)፦</b> <code>{ft}</code>\n📅 <b>መዓልቲ፦</b> <code>{date}</code>\n👤 <b>ስም ሰዳዲ፦</b> <code>{sender}</code>\n🎯 <b>ትኽክለኛነት ምንባብ፦</b> <code>{confidence}%</code>\n\n⚠️ <b>መተሓሳሰቢ፦</b> እዚ ምስ ኣረጋገጽኩም ደረሰኝ ናብቲ አስተዳዳሪ ክለኣኽ እዩ። ናይ FT ቁጽሪ ብንጹር ዝንበብ ምዃኑ የረጋግጹ።',
      'lottery.title': '🎉 <b>ናይ ዕጫ ውጽኢትን ታሪክን፦ {group}</b>\n─────────────────────────\n🎰 <b>ናይ ሕጂ ዕጫ ዑደት፦</b> <code>ዑደት #{cycle}</code>\n⏳ <b>ኩነታት፦</b> <code>{status}</code>\n\n<b>ዝሓለፉ ተዓወትቲ ታሪክ፦</b>\n',
      'lottery.empty': '  <i>ንእዚ ጉጅለ ክሳብ ሕጂ ዝወጸ ዕጫ የለን።</i>\n',
      'penalty.title': '⚠️ <b>ናይ ባዕለይ ቅላዕታት</b>\n─────────────────────────\n<i>ዝተነብሩ ቅላዕታት ዝርዝር፦</i>\n\n',
      'penalty.empty': '🟢 ዝተመዝገበ ቅላዕ የብልኩምን። ብጣዕሚ ጽቡቕ!',
      'penalty.detail': '⚠️ <b>ናይ ቅላዕ ዝርዝር ሓበሬታ</b>\n─────────────────────────\n📂 <b>ጉጅለ፦</b> <code>{group}</code>\n🔢 <b>ዑደት፦</b> <code>{cycle}</code>\n💰 <b>መጠን፦</b> {amount}\n📝 <b>ምኽንያት፦</b> <code>{reason}</code>\n⏳ <b>ኩነታት፦</b> {emoji} <code>{status}</code>\n📅 <b>ዝተነበረሉ መዓልቲ፦</b> <code>{issued}</code>\n{paid}{notes}',
      'dispute.title': '⚖️ <b>ናይ ባዕለይ ክርክራት</b>\n─────────────────────────\n',
      'dispute.empty': 'ዝተመዝገበ ናይ ክርክር መረዳእታ የለን።',
      'help.title': '🆘 <b>ናይ ዲጂታል እቁብ - ናይ ሓገዝ መምርሒ</b>\n─────────────────────────\nእንኳዕ ናብ ናይ ዲጂታል እቁብ ሓጋዚ ቦት ብደሓን መጻእኩም፡\n\n💡 <b>ትእዛዛት፦</b>\n• /start - ቀንዲ ማውጫ ይኸፍት\n• /menu - ቀልጣፋ ማውጫ የርኢ\n• /groups - እቁባትኩም ንምርኣይ\n• /status - ናይ ክፍሊት ኩነታትኩም ንምርኣይ\n• /profile - ነጥቢ ታማኝነትን መገለጽን የርኢ\n• /help - እዚ ናይ ሓገዝ ገጽ ይኸፍት',
      'btn.groups': '📋 ናይ ባዕለይ እቁባት',
      'btn.status': '📊 ክፍሊት ኩነታት ሰሌዳ',
      'btn.pay': '💳 መዋጮ የእቱ',
      'btn.lottery': '🎉 ውጽኢት ዕጫታት',
      'btn.penalties': '⚠️ ቅላዕታት',
      'btn.disputes': '⚖️ ክርክራት',
      'btn.profile': '👤 መገለጺይን ነጥብን',
      'btn.language': '🌐 ቋንቋ / Language',
      'btn.notifications': '🔔 ማሳወቂያታት',
      'btn.help': '🆘 ሓገዝን መምርሕን',
      'btn.back_menu': '🔙 ናብ ቀንዲ ማውጫ',
      'btn.back_groups': '🔙 ናብ እቁባት',
      'btn.back_group': '🔙 ናብቲ ጉጅለ',
      'btn.back_disputes': '🔙 ናብ ክርክራት',
      'btn.back_penalties': '🔙 ናብ ቅላዕታት',
      'btn.active_cycle': '🔄 ናይ ንጡፍ ዑደት ሓበሬታ',
      'btn.members': '👥 አባላት ጉጅለ',
      'btn.rules': '📜 ደንብታት ጉጅለ',
      'btn.pay_cycle': '💳 መዋጮ የእቱ',
    },
  };

  private static getStr(lang: string, key: string): string {
    const l = this.translations[lang] ? lang : 'en';
    return this.translations[l]?.[key] || this.translations['en']?.[key] || key;
  }

  static translate(lang: string, key: string): string {
    return this.getStr(lang, key);
  }

  static formatETB(amount: number): string {
    return `<b>ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>`;
  }

  static buildProgressBar(current: number, total: number, width = 10): string {
    if (total <= 0) return '░░░░░░░░░░';
    const percent = Math.min(1, Math.max(0, current / total));
    const filledCount = Math.round(percent * width);
    const emptyCount = width - filledCount;
    return '▓'.repeat(filledCount) + '░'.repeat(emptyCount);
  }

  static buildMainMenu(userName: string, lang = 'en'): string {
    return this.getStr(lang, 'welcome.back').replace('{name}', userName);
  }

  static buildWelcomeNewUser(telegramId: string, lang = 'en'): string {
    return this.getStr(lang, 'welcome.new').replace('{telegramId}', telegramId);
  }

  static buildGroupDetail(group: any, membership: any, activeCycle: any, lang = 'en'): string {
    const cycleText = activeCycle 
      ? `Cycle #${activeCycle.cycleNumber} (Status: ${activeCycle.status})`
      : this.getStr(lang, 'group.no_active_cycle');

    let content = this.getStr(lang, 'group.title')
      .replace('{name}', group.name)
      .replace('{description}', group.description || 'No description provided')
      .replace('{amount}', this.formatETB(group.contributionAmount))
      .replace('{frequency}', group.cycleType)
      .replace('{members}', group.memberships.length.toString())
      .replace('{maxMembers}', group.maxMembers.toString())
      .replace('{method}', group.lotteryMethod)
      .replace('{status}', group.status)
      .replace('{cycle}', cycleText)
      .replace('{shares}', membership.shares.toString())
      .replace('{memberStatus}', membership.status);

    if (group.bankAccount) {
      content += this.getStr(lang, 'group.bank_info')
        .replace('{bankName}', group.bankName || 'Unknown')
        .replace('{account}', group.bankAccount);
    }

    content += this.getStr(lang, 'group.prompt_nav');
    return content;
  }

  static buildGroupRules(rules: any, lang = 'en'): string {
    let msg = this.getStr(lang, 'rules.title');
    if (!rules) return msg + 'No rules configured.';

    const penaltyText = rules.latePenaltyType === 'FIXED'
      ? `${this.formatETB(rules.latePenaltyAmount)} (Fixed)`
      : rules.latePenaltyType === 'PERCENTAGE'
        ? `${rules.latePenaltyPercent}% of Contribution`
        : 'None';

    const disputeText = rules.disputeResolution === 'ADMIN_DECISION'
      ? 'Admin Decision'
      : rules.disputeResolution === 'MEMBER_VOTE'
        ? 'Member Vote'
        : 'Third Party';

    msg += this.getStr(lang, 'rules.late_rules')
      .replace('{type}', rules.latePenaltyType)
      .replace('{penalty}', penaltyText)
      .replace('{grace}', rules.gracePeriodDays.toString())
      .replace('{maxMissed}', rules.maxMissedPayments.toString());

    msg += this.getStr(lang, 'rules.deposit_rules')
      .replace('{exact}', rules.requireExactAmount ? 'Yes ✅' : 'No')
      .replace('{deadline}', rules.depositDeadlineDay ? 'Day ' + rules.depositDeadlineDay : 'Not set')
      .replace('{hours}', rules.minVerificationHours.toString());

    msg += this.getStr(lang, 'rules.member_rules')
      .replace('{govtId}', rules.requireGovernmentId ? 'Yes ✅' : 'No')
      .replace('{guarantor}', rules.requireGuarantor ? 'Yes ✅' : 'No')
      .replace('{midCycle}', rules.allowMidCycleJoin ? 'Allowed' : 'Forbidden ❌')
      .replace('{skipRound}', rules.allowSkipRound ? 'Yes (' + rules.maxSkipsAllowed + ' max)' : 'No');

    msg += this.getStr(lang, 'rules.gov_rules')
      .replace('{auto}', rules.autoCompleteGroup ? 'Yes' : 'No')
      .replace('{postWin}', rules.postWinContributionRequired ? 'Required ⚠️' : 'Optional')
      .replace('{schedule}', rules.payoutSchedule)
      .replace('{dispute}', disputeText);

    if (rules.customRules) {
      msg += `📝 <b>Additional Rules:</b>\n<i>${rules.customRules}</i>`;
    }

    return msg;
  }

  static buildMemberList(members: any[], lang = 'en'): string {
    let msg = this.getStr(lang, 'members.list_title');
    if (members.length === 0) return msg + this.getStr(lang, 'members.empty');

    members.forEach((m, index) => {
      const statusEmoji = m.status === 'ACTIVE' ? '🟢' : m.status === 'SUSPENDED' ? '🔴' : '🟡';
      msg += `${index + 1}. ${m.user.name} | ${statusEmoji} <code>${m.status}</code> | 🎟️ <code>${m.shares} share(s)</code>\n`;
    });
    return msg;
  }

  static buildActiveCycleInfo(cycle: any, group: any, deposits: any[], lang = 'en'): string {
    const totalShares = group.memberships.reduce((sum: number, m: any) => sum + (m.status === 'ACTIVE' ? m.shares : 0), 0);
    const expectedPayout = group.contributionAmount * totalShares;
    
    let msg = this.getStr(lang, 'cycle.title')
      .replace('{num}', cycle.cycleNumber.toString())
      .replace('{duration}', `${new Date(cycle.startDate).toLocaleDateString()} - ${new Date(cycle.endDate).toLocaleDateString()}`)
      .replace('{status}', cycle.status)
      .replace('{payout}', this.formatETB(expectedPayout))
      .replace('{shares}', totalShares.toString());

    if (deposits.length === 0) {
      msg += this.getStr(lang, 'cycle.no_deposits');
    } else {
      deposits.forEach((dep) => {
        const verifyEmoji = dep.verificationStatus === 'VERIFIED' ? '✅' : dep.verificationStatus === 'REJECTED' ? '❌' : '⏳';
        msg += `  • ${dep.user.name}: ${verifyEmoji} <code>${dep.verificationStatus}</code>` + 
          (dep.amount ? ` (${this.formatETB(dep.amount)})` : '') + '\n';
      });
    }

    if (cycle.winner) {
      msg += this.getStr(lang, 'cycle.winner').replace('{winner}', cycle.winner.name);
    }
    
    return msg;
  }

  static buildStatusDashboard(user: any, memberships: any[], lang = 'en'): string {
    let msg = this.getStr(lang, 'dashboard.title')
      .replace('{name}', user.name)
      .replace('{score}', user.reliabilityScore.toString());

    if (memberships.length === 0) {
      msg += this.getStr(lang, 'dashboard.empty');
      return msg;
    }

    memberships.forEach((m) => {
      const activeCycle = m.group.cycles.find((c: any) => c.status === 'ACTIVE');
      let cycleText = 'No active cycle';
      let payStatus = this.getStr(lang, 'dashboard.unpaid');

      if (activeCycle) {
        cycleText = `Cycle #${activeCycle.cycleNumber}`;
        const userDeposit = activeCycle.deposits.find((d: any) => d.userId === user.id);
        if (userDeposit) {
          const depEmoji = userDeposit.verificationStatus === 'VERIFIED' ? '✅' : userDeposit.verificationStatus === 'REJECTED' ? '❌' : '⏳';
          payStatus = `${depEmoji} <code>${userDeposit.verificationStatus}</code>`;
        }
      }

      msg += this.getStr(lang, 'dashboard.group_card')
        .replace('{name}', m.group.name)
        .replace('{amount}', this.formatETB(m.group.contributionAmount))
        .replace('{frequency}', m.group.cycleType)
        .replace('{status}', m.status)
        .replace('{cycle}', cycleText)
        .replace('{payStatus}', payStatus);
    });

    return msg;
  }

  static buildProfileCard(user: any, memberships: any[], depositsCount: number, penaltiesCount: number, disputesCount: number, lang = 'en'): string {
    const reliabilityEmoji = user.reliabilityScore >= 90 ? '🌟' : user.reliabilityScore >= 75 ? '🟢' : user.reliabilityScore >= 50 ? '🟡' : '🔴';
    return this.getStr(lang, 'profile.title')
      .replace('{name}', user.name)
      .replace('{phone}', user.phone)
      .replace('{telegramId}', user.telegramId || 'Not Linked')
      .replace('{country}', user.country || 'Ethiopia')
      .replace('{location}', `${user.city || ''} ${user.subCity ? ', ' + user.subCity : ''}`.trim() || 'N/A')
      .replace('{emoji}', reliabilityEmoji)
      .replace('{score}', user.reliabilityScore.toString())
      .replace('{progress}', this.buildProgressBar(user.reliabilityScore, 100))
      .replace('{groups}', memberships.length.toString())
      .replace('{deposits}', depositsCount.toString())
      .replace('{penalties}', penaltiesCount.toString())
      .replace('{disputes}', disputesCount.toString());
  }

  static buildDepositPrompt(group: any, cycle: any, lang = 'en'): string {
    const bankSection = group.bankAccount 
      ? `• <b>Transfer details:</b> ${group.bankName || 'Unknown'} - <code>${group.bankAccount}</code>\n`
      : '';
    return this.getStr(lang, 'deposit.prompt')
      .replace('{group}', group.name)
      .replace('{cycle}', cycle.cycleNumber.toString())
      .replace('{amount}', this.formatETB(group.contributionAmount))
      .replace('{bank}', bankSection);
  }

  static buildOCRConfirmation(ocrResult: any, lang = 'en'): string {
    return this.getStr(lang, 'ocr.confirm')
      .replace('{bank}', ocrResult.bankName || 'Not Detected')
      .replace('{amount}', ocrResult.amount ? this.formatETB(ocrResult.amount) : 'Not Detected')
      .replace('{ft}', ocrResult.ftNumber || 'Not Detected')
      .replace('{date}', ocrResult.depositDate ? new Date(ocrResult.depositDate).toLocaleDateString() : 'Not Detected')
      .replace('{sender}', ocrResult.senderName || 'Not Detected')
      .replace('{confidence}', ocrResult.confidence ? Math.round(ocrResult.confidence * 100).toString() : '0');
  }

  static buildLotteryDashboard(groupName: string, activeCycle: any, previousWinners: any[], lang = 'en'): string {
    let msg = this.getStr(lang, 'lottery.title')
      .replace('{group}', groupName)
      .replace('{cycle}', activeCycle ? activeCycle.cycleNumber.toString() : 'N/A')
      .replace('{status}', activeCycle ? activeCycle.status : 'Inactive');

    if (previousWinners.length === 0) {
      msg += this.getStr(lang, 'lottery.empty');
    } else {
      previousWinners.forEach((w) => {
        msg += `  • Cycle #${w.cycle.cycleNumber}: 🏆 <b>${w.winner.name}</b> won ${this.formatETB(w.amountWon)}\n`;
      });
    }

    return msg;
  }

  static buildPenaltyList(penalties: any[], lang = 'en'): string {
    let msg = this.getStr(lang, 'penalty.title');
    if (penalties.length === 0) return this.getStr(lang, 'penalty.empty');
    return msg;
  }

  static buildPenaltyDetail(penalty: any, lang = 'en'): string {
    const statusEmoji = penalty.status === 'PAID' ? '✅' : penalty.status === 'WAIVED' ? '⚪' : '🚨';
    const paidText = penalty.paidAt 
      ? `📅 <b>Paid On:</b> <code>${new Date(penalty.paidAt).toLocaleDateString()}</code>\n`
      : '';
    const notesText = penalty.notes 
      ? `💬 <b>Notes:</b> <i>${penalty.notes}</i>\n`
      : '';

    return this.getStr(lang, 'penalty.detail')
      .replace('{group}', penalty.group.name)
      .replace('{cycle}', penalty.cycle ? 'Cycle #' + penalty.cycle.cycleNumber : 'N/A')
      .replace('{amount}', this.formatETB(penalty.amount))
      .replace('{reason}', penalty.reason.replace('_', ' '))
      .replace('{emoji}', statusEmoji)
      .replace('{status}', penalty.status)
      .replace('{issued}', new Date(penalty.createdAt).toLocaleDateString())
      .replace('{paid}', paidText)
      .replace('{notes}', notesText);
  }

  static buildDisputeList(disputes: any[], lang = 'en'): string {
    let msg = this.getStr(lang, 'dispute.title');
    if (disputes.length === 0) return msg + this.getStr(lang, 'dispute.empty');

    disputes.forEach((d) => {
      const statusEmoji = d.status === 'RESOLVED' ? '✅' : d.status === 'DISMISSED' ? '⚪' : '⏳';
      msg += `• <b>${d.type.replace('_', ' ')}</b> (${statusEmoji} <code>${d.status}</code>)\n` +
             `  └ Description: <i>${d.description.substring(0, 60)}...</i>\n` +
             `  └ Group: <code>${d.group.name}</code>\n\n`;
    });
    return msg;
  }

  static buildHelp(category = 'general', lang = 'en'): string {
    return this.getStr(lang, 'help.title');
  }
}
