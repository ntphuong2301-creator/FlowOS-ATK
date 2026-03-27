/**
 * LarkService — Gửi thông báo cản trở qua Lark Bot API
 * Docs: https://open.larksuite.com/open-apis
 *
 * Cần biến môi trường: LARK_APP_ID, LARK_APP_SECRET
 * Nếu chưa cấu hình, các phương thức sẽ log warning và return mà không lỗi.
 */

const LARK_API = "https://open.larksuite.com/open-apis";

const MUCDO_LABEL: Record<string, string> = {
  RAT_NGHIEM_TRONG: "🔴 Rất nghiêm trọng",
  VUA_PHAI: "🟡 Vừa phải",
  NHE: "🟢 Nhẹ",
};

const NHOM_CHAT: Record<string, string> = {
  SOS: process.env.LARK_CHAT_SOS ?? "",
  "R&D": process.env.LARK_CHAT_RD ?? "",
  "DA Nắp": process.env.LARK_CHAT_NAP ?? "",
  "Tất cả": process.env.LARK_CHAT_ALL ?? "",
};

async function layAccessToken(): Promise<string | null> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    console.warn("[Lark] LARK_APP_ID hoặc LARK_APP_SECRET chưa được cấu hình");
    return null;
  }
  try {
    const res = await fetch(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = (await res.json()) as { tenant_access_token?: string; code?: number };
    if (data.code !== 0 || !data.tenant_access_token) {
      console.warn("[Lark] Lấy access token thất bại:", data);
      return null;
    }
    return data.tenant_access_token;
  } catch (err) {
    console.warn("[Lark] Lỗi kết nối:", err);
    return null;
  }
}

async function guiTin(
  token: string,
  chatId: string,
  msgType: string,
  content: string,
  replyMsgId?: string
): Promise<string | null> {
  try {
    const url = replyMsgId
      ? `${LARK_API}/im/v1/messages/${replyMsgId}/reply`
      : `${LARK_API}/im/v1/messages?receive_id_type=chat_id`;

    const body = replyMsgId
      ? { msg_type: msgType, content }
      : { receive_id: chatId, msg_type: msgType, content };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { data?: { message_id?: string }; code?: number };
    if (data.code !== 0) {
      console.warn("[Lark] Gửi tin thất bại:", data);
      return null;
    }
    return data.data?.message_id ?? null;
  } catch (err) {
    console.warn("[Lark] Lỗi gửi tin:", err);
    return null;
  }
}

export interface ThongTinCanTro {
  id: string;
  ten: string;
  mucDo: string;
  hanXuLy?: Date | null;
  larkMessageId?: string | null;
  larkChatId?: string | null;
}

export interface ThongTinCongViec {
  ten: string;
}

export interface ThongTinDuAn {
  ten: string;
}

export interface ThongTinNguoiDung {
  ten: string;
  email: string;
  larkUserId?: string | null;
}

// ─── Phương thức công khai ─────────────────────────────────────────────────

/**
 * Gửi cảnh báo cản trở mới vào nhóm Lark
 * @returns larkMessageId để lưu vào bảng can_tro
 */
export async function guiCanhBaoCanTro(
  canTro: ThongTinCanTro,
  congViec: ThongTinCongViec | null,
  duAn: ThongTinDuAn,
  nguoiXuLy: ThongTinNguoiDung | null,
  chatId?: string
): Promise<string | null> {
  const token = await layAccessToken();
  if (!token) return null;

  const targetChat = chatId ?? NHOM_CHAT["Tất cả"];
  if (!targetChat) {
    console.warn("[Lark] Chưa cấu hình LARK_CHAT_ALL");
    return null;
  }

  const hanXuLy = canTro.hanXuLy
    ? new Date(canTro.hanXuLy).toLocaleDateString("vi-VN")
    : "Chưa xác định";

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "🔴 Cản trở mới phát sinh" },
      template: "red",
    },
    elements: [
      {
        tag: "div",
        fields: [
          {
            is_short: false,
            text: {
              tag: "lark_md",
              content: `**Hạng mục cản trở:**\n${canTro.ten}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**Mức độ:**\n${MUCDO_LABEL[canTro.mucDo] ?? canTro.mucDo}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**Dự án:**\n${duAn.ten}`,
            },
          },
        ],
      },
      {
        tag: "div",
        fields: [
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**Công việc bị chặn:**\n${congViec?.ten ?? "—"}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: "lark_md",
              content: `**Người xử lý:**\n${nguoiXuLy?.ten ?? "Chưa chỉ định"}`,
            },
          },
        ],
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**⏰ Hạn xử lý:** ${hanXuLy}`,
        },
      },
      { tag: "hr" },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "Xử lý ngay" },
            type: "primary",
            url: `${process.env.APP_URL ?? ""}/can-tro`,
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "Xem chi tiết" },
            type: "default",
            url: `${process.env.APP_URL ?? ""}/can-tro`,
          },
        ],
      },
    ],
  };

  return guiTin(token, targetChat, "interactive", JSON.stringify(card));
}

/**
 * Gửi thông báo đã giải quyết, reply vào thread gốc
 */
export async function guiDaGiaiQuyet(
  canTro: ThongTinCanTro,
  nguoiGiaiQuyet: ThongTinNguoiDung
): Promise<void> {
  const token = await layAccessToken();
  if (!token) return;

  const chatId = canTro.larkChatId ?? NHOM_CHAT["Tất cả"];
  if (!chatId) return;

  const content = JSON.stringify({
    text: `✅ Đã giải quyết: ${canTro.ten}\n👤 Bởi: ${nguoiGiaiQuyet.ten}`,
  });

  if (canTro.larkMessageId) {
    await guiTin(token, chatId, "text", content, canTro.larkMessageId);
  } else {
    await guiTin(token, chatId, "text", content);
  }
}

/**
 * Gửi thông báo timeline bị ảnh hưởng đến incharge của task downstream
 */
export async function guiThongBaoTimeline(params: {
  tenTaskNguon: string;
  soNgayTre: number;
  tenTaskBiAnh: string;
  ngayKTGoc: Date | null;
  ngayKTMoi: Date | null;
  tenBuoc: string;
  larkUserIdNguoiNhan: string | null | undefined;
  launchBiAnh?: boolean;
}): Promise<void> {
  const token = await layAccessToken();
  if (!token) return;

  const {
    tenTaskNguon,
    soNgayTre,
    tenTaskBiAnh,
    ngayKTGoc,
    ngayKTMoi,
    tenBuoc,
    larkUserIdNguoiNhan,
    launchBiAnh,
  } = params;

  const hanCu = ngayKTGoc ? new Date(ngayKTGoc).toLocaleDateString("vi-VN") : "—";
  const hanMoi = ngayKTMoi ? new Date(ngayKTMoi).toLocaleDateString("vi-VN") : "—";
  const appUrl = process.env.APP_URL ?? "";

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "⚠️ Thông báo tác động timeline" },
      template: "yellow",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${tenTaskNguon}** bị trễ **${soNgayTre} ngày**\n→ Ảnh hưởng đến task của bạn:`,
        },
      },
      {
        tag: "div",
        fields: [
          { is_short: false, text: { tag: "lark_md", content: `📋 **${tenTaskBiAnh}**` } },
          { is_short: true, text: { tag: "lark_md", content: `**Hạn cũ:** ${hanCu}` } },
          { is_short: true, text: { tag: "lark_md", content: `**Hạn mới dự kiến:** ${hanMoi}` } },
          { is_short: false, text: { tag: "lark_md", content: `**Bước:** ${tenBuoc}` } },
        ],
      },
      ...(launchBiAnh
        ? [
            {
              tag: "div",
              text: {
                tag: "lark_md",
                content: `🚀 **Cảnh báo:** Thay đổi này có thể ảnh hưởng đến ngày Launch!`,
              },
            },
          ]
        : []),
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**Hành động đề xuất:**\n- Kiểm tra lại kế hoạch của bạn\n- Vào FlowOS để cập nhật timeline`,
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "Xem chi tiết →" },
            type: "primary",
            url: `${appUrl}/dong-chay-du-an`,
          },
        ],
      },
    ],
  };

  // Gửi DM cho incharge
  if (larkUserIdNguoiNhan) {
    try {
      const res = await fetch(`${LARK_API}/im/v1/messages?receive_id_type=open_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receive_id: larkUserIdNguoiNhan,
          msg_type: "interactive",
          content: JSON.stringify(card),
        }),
      });
      const data = await res.json() as { code?: number };
      if (data.code !== 0) console.warn("[Lark Timeline] Gửi DM thất bại:", data);
    } catch (err) {
      console.warn("[Lark Timeline] Lỗi gửi DM:", err);
    }
  }

  // Gửi vào nhóm SOS nếu launch bị ảnh hưởng
  if (launchBiAnh && NHOM_CHAT["SOS"]) {
    await guiTin(token, NHOM_CHAT["SOS"], "interactive", JSON.stringify(card));
  }
}

/**
 * Gửi tóm tắt AI buổi sáng
 */
export async function guiTomTatSang(
  chatId: string,
  noiDungTomTat: string
): Promise<void> {
  const token = await layAccessToken();
  if (!token) return;

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "📋 Tóm tắt hàng ngày — FlowOS ATK" },
      template: "green",
    },
    elements: [
      {
        tag: "div",
        text: { tag: "lark_md", content: noiDungTomTat },
      },
    ],
  };

  await guiTin(token, chatId, "interactive", JSON.stringify(card));
}
