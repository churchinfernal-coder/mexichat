# Fix 1: Pagos.tsx — add type to destructured data
with open("src/pages/Pagos.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    ".then(({ data }) => setMpConnected(!!data));",
    ".then(({ data }: any) => setMpConnected(!!data));"
)

with open("src/pages/Pagos.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("OK 1/2 — Pagos.tsx")

# Fix 2: pushNotifications.ts — cast urlBase64ToUint8Array returns
with open("src/services/pushNotifications.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "async function getVapidPublicKey(): Promise<BufferSource | null> {",
    "async function getVapidPublicKey(): Promise<ArrayBuffer | Uint8Array | null> {"
)

# Cast all returns from urlBase64ToUint8Array to satisfy the type
content = content.replace(
    '''    if ((data as any)?.value) {
      return urlBase64ToUint8Array((data as any).value);''',
    '''    if ((data as any)?.value) {
      return urlBase64ToUint8Array((data as any).value) as Uint8Array;'''
)

content = content.replace(
    '''      return urlBase64ToUint8Array(meta.getAttribute("content") || "");''',
    '''      return urlBase64ToUint8Array(meta.getAttribute("content") || "") as Uint8Array;'''
)

with open("src/services/pushNotifications.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK 2/2 — pushNotifications.ts")
