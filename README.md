# EcoFood Automation Test

Flow 01–03 kiểm tra frontend image. Flow 04–06 kiểm tra nghiệp vụ trên staging.

## Chạy ba flow nghiệp vụ

Điền các biến trong `.env.example` vào `.env` local và đặt `E2E_BUSINESS=1`. Chạy từ repo automation với Node 20.6 trở lên:

```powershell
npm ci
npx playwright install chromium
node --env-file=.env ./node_modules/@playwright/test/cli.js test "flow-0[456]" --workers=1
```

- **04** tạo enterprise tenant qua API. Cần token onboarding, frontend wildcard (ví dụ `E2E_TENANT_BASE_URL=https://staging.example.test`), SMTP của realm mới gửi được email tới TempMail.Plus (fexpost.com). Script đọc thư theo người nhận, đặt mật khẩu rồi đăng nhập trong browser context mới.
- **05** dùng token nội bộ của enterprise và người duyệt, brand và distribution partner hợp lệ của enterprise. Region phải khớp quốc gia của partner. Test kiểm tra các API ghi dữ liệu và đọc lại plan.
- **06** dùng URL POST, headers và request JSON thực tế của HashCore sandbox. Gắn `{{invoiceNumber}}` vào trường được ánh xạ thành số hóa đơn EcoFood. Payload phải tạo một hóa đơn trong kỳ hiện tại. Token đọc transaction phải thuộc tenant POS. Dùng một tenant/proposition riêng để so dashboard trước và sau khi KPI worker xử lý. Assertion kiểm tra API Business Dashboard.

Khi chạy trên CI, truyền các biến từ staging secrets/variables vào bước Playwright. Nếu thiếu cờ bật, ba flow được báo skipped. Dữ liệu lưu ở staging sau test; dùng tenant/DB có thể reset. Áp dụng chính sách dọn dữ liệu của môi trường cho realm, mailbox và các bản ghi nghiệp vụ.

## First-time setup (required)

```powershell
npm install -D @playwright/test@latest
npx playwright install chromium
```

Commit `package.json` và `package-lock.json` vừa tạo. GitHub Actions dùng `npm ci`, nên **phải có** `package-lock.json` trước khi bật CD.

## Local Vite

Terminal 1: `npm run dev` trong repo FE.

Terminal 2 trong repo Automation:

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:5173"
npx playwright test
```

Flow 02 yêu cầu JS bundle trong HTML; Vite dev dùng script `/src/main.jsx` hoặc `/src/main.tsx`, vì vậy **Flow 02 chủ yếu dành cho Docker image đã build**. Để test đúng với CD, chạy frontend image tại `http://127.0.0.1:8080`.

## GitHub Actions

1. Tạo repo `thinh-17/EcoFood-Automation-Test`; push các file này và `package-lock.json`.
2. Trong repo FE thêm secret `AUTOMATION_REPO_READ_TOKEN` (fine-grained PAT chỉ có Contents: Read trên repo Automation), nếu repo Automation là private.
3. Nếu repo Automation public, xóa `token: ...` trong bước checkout Automation ở FE workflow.
4. Workflow FE checkout repo Automation trên `main`, pull Docker image từ GHCR, chạy 3 flow, rồi mới deploy Azure VM nếu pass.
5. Giữ repository Automation được kiểm soát quyền ghi. Với production gate nên pin ref vào tag/commit SHA đã review thay vì branch `main`.

**Security**: Docker FE hiện được build với API/Keycloak production. Các flow này không ghi dữ liệu và browser test tắt JS. Không dùng test nghiệp vụ tạo dữ liệu cho đến khi cấu hình staging riêng (VITE_API_BASE_URL, VITE_KEYCLOAK_BASE_URL, Backend, Keycloak, database).
