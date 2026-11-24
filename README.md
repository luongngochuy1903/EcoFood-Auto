# EcoFood Automation Test

Repo riêng chứa Playwright. 3 flow hiện tại chỉ là **Docker frontend smoke checks**, không phải 3 luồng nghiệp vụ Onboarding/Product/Submission. Thay thế hoặc mở rộng `tests/e2e/flow-*.spec.ts` khi có selectors và staging backend.

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
