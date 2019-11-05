import { Request, Response } from "express"
import { withBrowser } from "./browser"

/**
 * The name of this export must match the `--entry-point` option in
 * the deploy script.
 */
export default async function main(req: Request, res: Response) {
	console.log("1")
	await withBrowser(async browser => {
		console.log("2")
		await browser.visit("https://www.notion.so")
		console.log("3")
		// Wait for the product page to load.
		await browser.findText("All-in-one workspace")
		console.log("4")
		const source = await browser.driver.getPageSource()
		console.log("5")
		res.status(200).send(source)
		console.log("6")
		// const fileName = `/tmp/screenshot-${Date.now()}.png`
		// await browser.saveScreenshotPng(fileName)
	})
	console.log("7")
}
