import { expect, test } from "@playwright/test";

test("renders the dashboard shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("LLM Arena 综合性能看板")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /把 Arena 排名/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "能力 / 价格" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型对照表" })).toBeVisible();
  await expect(page.getByText("当前可见模型")).toBeVisible();
  await expect(page.getByText("手动刷新")).toHaveCount(0);
});
