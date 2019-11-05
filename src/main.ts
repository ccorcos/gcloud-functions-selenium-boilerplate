import { Request, Response } from "express"
import { withBrowser } from "./browser"

/**
 * The name of this export must match the `--entry-point` option in
 * the deploy script.
 */
export default async function main(req: Request, res: Response) {
	await withBrowser(async browser => {
		await browser.visit("https://www.notion.so")

		// Wait for the product page to load.
		await browser.findText("All-in-one workspace")

		const source = await browser.driver.getPageSource()
		res.status(200).send(source)

		// const fileName = `/tmp/screenshot-${Date.now()}.png`
		// await browser.saveScreenshotPng(fileName)
	})
}
