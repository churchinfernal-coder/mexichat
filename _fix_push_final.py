with open("src/services/pushNotifications.ts", "r", encoding="utf-8") as f:
    content = f.read()

# The issue: applicationServerKey expects string | BufferSource | null
# But our function returns ArrayBuffer | Uint8Array | null
# Fix: just type the return as any since the runtime value is correct
content = content.replace(
    "async function getVapidPublicKey(): Promise<ArrayBuffer | Uint8Array | null> {",
    "async function getVapidPublicKey(): Promise<BufferSource | null> {"
)

# Cast the returns explicitly
content = content.replace(
    "return urlBase64ToUint8Array((data as any).value) as Uint8Array;",
    "return urlBase64ToUint8Array((data as any).value) as unknown as BufferSource;"
)

content = content.replace(
    'return urlBase64ToUint8Array(meta.getAttribute("content") || "") as Uint8Array;',
    'return urlBase64ToUint8Array(meta.getAttribute("content") || "") as unknown as BufferSource;'
)

with open("src/services/pushNotifications.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK — pushNotifications.ts final fix")
