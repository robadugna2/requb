import { InlineKeyboard } from 'grammy';
import { TelegramMessages } from './telegram-messages';

export class TelegramKeyboards {
  static mainMenu(lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.groups'), 'menu:groups')
      .text(TelegramMessages.translate(lang, 'btn.status'), 'menu:status')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.pay'), 'menu:pay')
      .text(TelegramMessages.translate(lang, 'btn.lottery'), 'menu:lottery')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.penalties'), 'menu:penalties')
      .text(TelegramMessages.translate(lang, 'btn.disputes'), 'menu:disputes')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.profile'), 'menu:profile')
      .text(TelegramMessages.translate(lang, 'btn.language'), 'menu:language')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.notifications'), 'menu:notifications')
      .text(TelegramMessages.translate(lang, 'btn.help'), 'menu:help');
  }

  static languageSelect(lang = 'en') {
    return new InlineKeyboard()
      .text('English 🇺🇸', 'lang:select:en')
      .text('አማርኛ 🇪🇹', 'lang:select:am')
      .row()
      .text('Afaan Oromoo 🇪🇹', 'lang:select:om')
      .text('ትግርኛ 🇪🇹', 'lang:select:ti')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
  }

  static groupList(groups: { id: string; name: string }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    groups.forEach((group) => {
      keyboard.text(`📁 ${group.name}`, `grp:detail:${group.id}`).row();
    });
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
    return keyboard;
  }

  static groupDetail(groupId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.active_cycle'), `grp:cycle:${groupId}`)
      .text(TelegramMessages.translate(lang, 'btn.members'), `grp:members:${groupId}`)
      .row()
      .text(TelegramMessages.translate(lang, 'btn.rules'), `grp:rules:${groupId}`)
      .text(TelegramMessages.translate(lang, 'btn.pay_cycle'), `dep:select:${groupId}`)
      .row()
      .text(TelegramMessages.translate(lang, 'btn.back_groups'), 'menu:groups');
  }

  static depositGroupSelector(groups: { id: string; name: string }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    groups.forEach((group) => {
      keyboard.text(`💳 ${TelegramMessages.translate(lang, 'btn.pay_cycle')}: ${group.name}`, `dep:select:${group.id}`).row();
    });
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
    return keyboard;
  }

  static confirmDeposit(tempDepositId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.confirm'), `dep:confirm:${tempDepositId}`)
      .text(TelegramMessages.translate(lang, 'btn.cancel'), `dep:cancel:${tempDepositId}`);
  }

  static disputeMainMenu(lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.dispute_file'), 'dis:file_start')
      .text(TelegramMessages.translate(lang, 'btn.dispute_list'), 'dis:list')
      .row()
      .text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
  }

  static disputeGroupSelector(groups: { id: string; name: string }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    groups.forEach((group) => {
      keyboard.text(TelegramMessages.translate(lang, 'btn.dispute_label').replace('{name}', group.name), `dis:group:${group.id}`).row();
    });
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_disputes'), 'menu:disputes');
    return keyboard;
  }

  static disputeTypeSelector(groupId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.dispute_payment'), `dis:type:${groupId}:PAYMENT_DISPUTE`).row()
      .text(TelegramMessages.translate(lang, 'btn.dispute_payout'), `dis:type:${groupId}:PAYOUT_DISPUTE`).row()
      .text(TelegramMessages.translate(lang, 'btn.dispute_membership'), `dis:type:${groupId}:MEMBERSHIP_DISPUTE`).row()
      .text(TelegramMessages.translate(lang, 'btn.dispute_lottery'), `dis:type:${groupId}:LOTTERY_DISPUTE`).row()
      .text(TelegramMessages.translate(lang, 'btn.dispute_general'), `dis:type:${groupId}:GENERAL`).row()
      .text(TelegramMessages.translate(lang, 'btn.back_group'), `grp:detail:${groupId}`);
  }

  static penaltyList(penalties: { id: string; amount: number; groupName: string; status: string }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    penalties.forEach((p) => {
      const statusEmoji = p.status === 'PAID' ? '✅' : p.status === 'WAIVED' ? '⚪' : '🔴';
      keyboard.text(`${statusEmoji} ETB ${p.amount} (${p.groupName})`, `pen:detail:${p.id}`).row();
    });
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
    return keyboard;
  }

  static penaltyDetail(penaltyId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.back_penalties'), 'menu:penalties');
  }

  static turnSwapMenu(groupId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.swap_req'), `lot:swap_req_start:${groupId}`)
      .text(TelegramMessages.translate(lang, 'btn.swap_incoming'), `lot:swap_incoming:${groupId}`)
      .row()
      .text(TelegramMessages.translate(lang, 'btn.back_group'), `grp:detail:${groupId}`);
  }

  static turnSwapUserSelector(groupId: string, members: { userId: string; name: string }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    members.forEach((m) => {
      keyboard.text(TelegramMessages.translate(lang, 'btn.swap_with').replace('{name}', m.name), `lot:swap_target:${groupId}:${m.userId}`).row();
    });
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_group'), `grp:detail:${groupId}`);
    return keyboard;
  }

  static turnSwapResponse(requestId: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.swap_accept'), `lot:swap_accept:${requestId}`)
      .text(TelegramMessages.translate(lang, 'btn.swap_decline'), `lot:swap_decline:${requestId}`);
  }

  static notificationsList(notifications: { id: string; title: string; read: boolean }[], lang = 'en') {
    const keyboard = new InlineKeyboard();
    notifications.slice(0, 10).forEach((n) => {
      const readMarker = n.read ? '📖' : '🆕';
      keyboard.text(`${readMarker} ${n.title}`, `not:detail:${n.id}`).row();
    });
    if (notifications.some((n) => !n.read)) {
      keyboard.text(TelegramMessages.translate(lang, 'btn.notifications_read_all'), 'not:read_all').row();
    }
    keyboard.text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
    return keyboard;
  }

  static notificationDetail(id: string, lang = 'en') {
    return new InlineKeyboard()
      .text(TelegramMessages.translate(lang, 'btn.delete'), `not:delete:${id}`)
      .text(TelegramMessages.translate(lang, 'btn.back_menu'), 'menu:notifications');
  }

  static backToMain(lang = 'en') {
    return new InlineKeyboard().text(TelegramMessages.translate(lang, 'btn.back_menu'), 'nav:main');
  }

  static backToGroup(groupId: string, lang = 'en') {
    return new InlineKeyboard().text(TelegramMessages.translate(lang, 'btn.back_group'), `grp:detail:${groupId}`);
  }
}
