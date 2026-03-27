export async function goiApi(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { thongBao?: string }).thongBao ?? "Lỗi tải dữ liệu");
  }
  return res.json();
}
