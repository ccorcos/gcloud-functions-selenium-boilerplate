/* =============================================================================

	Selenium Browser Framework

============================================================================= */

// Importing chromedriver will add its exececutable script to the environment PATH.
// GCloud should have chrome installed somewhere.
import "chromedriver"
import {
	Builder,
	ThenableWebDriver,
	By,
	WebElement,
	Key,
	Condition,
} from "selenium-webdriver"
import { Options } from "selenium-webdriver/chrome"
import { IKey } from "selenium-webdriver/lib/input"
import * as fs from "fs-extra"
import * as path from "path"
import * as chromium from "chromium-version"

const defaultTimeoutMs = 60_000

export async function withBrowser(
	fn: (browser: Browser) => Promise<void>,
	headless = true
) {
	const chromeOptions = new Options()
	chromeOptions.setChromeBinaryPath(chromium.path)
	chromeOptions.addArguments("--no-sandbox")
	chromeOptions.addArguments("--disable-dev-shm-usage") // overcome limited resource problems
	if (headless) {
		chromeOptions.headless()
	}

	const driver = new Builder()
		.forBrowser("chrome")
		.setChromeOptions(chromeOptions)
		.build()
	try {
		await fn(new Browser(driver))
		await driver.quit()
	} catch (error) {
		if (headless) {
			await driver.quit()
		}
		throw error
	}
}

/**
 * Stringifies a function to run inside the browser.
 */
async function executeScript<T>(
	driver: ThenableWebDriver,
	arg: T,
	fn: (arg: T, callback: () => void) => void
) {
	try {
		await driver.executeAsyncScript(
			`try { (${fn.toString()}).apply({}, arguments) } catch (error) { console.error(error) }`,
			arg
		)
	} catch (error) {}
}

/**
 * Wrap any promised coming from the Selenium driver so that we can
 * get stack traces that point to our code.
 */
async function wrapError<T>(p: Promise<T>) {
	const e = new Error()
	e["__wrapError"] = true
	try {
		const result = await p
		// Wait just a little bit in case the browser is about to navigate
		// or something.
		await new Promise(resolve => setTimeout(resolve, 20))
		return result
	} catch (error) {
		if (error["__wrapError"]) {
			throw error
		}
		e.message = error.message
		throw e
	}
}

async function waitFor(
	driver: ThenableWebDriver,
	fn: () => Promise<boolean | object>,
	timeout = defaultTimeoutMs
) {
	await driver.wait(
		new Condition("wait", async () => {
			try {
				const result = await fn()
				return Boolean(result)
			} catch (error) {
				return false
			}
		}),
		timeout
	)
}

/**
 * Represents a single Selenium WebElement wrapped in an object with
 * various helper methods.
 */
class Element {
	private promise: Promise<WebElement>
	then: Promise<WebElement>["then"]
	catch: Promise<WebElement>["catch"]

	constructor(
		public driver: ThenableWebDriver,
		promise: Promise<WebElement> | WebElement
	) {
		this.promise = Promise.resolve(promise)
		this.then = this.promise.then.bind(this.promise)
		this.catch = this.promise.catch.bind(this.promise)
	}

	/** Map in the monadic sense. */
	map(fn: (elm: WebElement) => Promise<WebElement | undefined | void>) {
		return new Element(
			this.driver,
			wrapError(
				this.promise.then(async elm => {
					const result = await fn(elm)
					if (result) {
						return result
					} else {
						return elm
					}
				})
			)
		)
	}

	waitFor(
		fn: (elm: WebElement) => Promise<boolean | object>,
		timeout?: number
	) {
		return this.map(elm => waitFor(this.driver, () => fn(elm), timeout))
	}

	mapWait(fn: (elm: WebElement) => Promise<WebElement>, timeout?: number) {
		return this.waitFor(fn, timeout).map(fn)
	}

	click() {
		return this.map(elm => elm.click())
	}

	clear() {
		return this.map(elm => elm.clear())
	}

	type(text: string) {
		return this.map(elm => elm.sendKeys(text))
	}

	enter() {
		return this.map(elm => elm.sendKeys(Key.RETURN))
	}

	tab() {
		return this.map(elm => elm.sendKeys(Key.TAB))
	}

	backspace() {
		return this.map(elm => elm.sendKeys(Key.BACK_SPACE))
	}

	find(selector: string) {
		return this.mapWait(elm => {
			return elm.findElement(By.css(selector))
		})
	}

	findAll(selector: string) {
		return new Elements(
			this.driver,
			this.promise.then(elm => {
				return waitFor(this.driver, () =>
					elm.findElements(By.css(selector))
				).then(() => {
					return elm.findElements(By.css(selector))
				})
			})
		)
	}

	/**
	 * Find an element with exact text.
	 */
	findText(text: string) {
		return this.mapWait(elm => {
			return elm.findElement(By.xpath(`.//*[contains(text(), '${text}')]`))
		})
	}

	clickText(text: string) {
		return this.findText(text).click()
	}

	hover() {
		return this.map(async elm => {
			const rect = await elm.getRect()
			const x = rect.x + rect.width / 2
			const y = rect.y + rect.height / 2
			await executeScript(this.driver, { x, y }, (arg, callback) => {
				const elm = document.elementFromPoint(arg.x, arg.y)
				if (elm) {
					elm.dispatchEvent(
						new Event("mousemove", { bubbles: true, cancelable: false })
					)
				}
				callback()
			})
			return elm
		})
	}
}

/**
 * Represents a multiple Selenium WebElements wrapped in an object with
 * various helper methods.
 */
class Elements {
	private promise: Promise<Array<WebElement>>
	then: Promise<Array<WebElement>>["then"]
	catch: Promise<Array<WebElement>>["catch"]

	constructor(
		public driver: ThenableWebDriver,
		promise: Promise<Array<WebElement>> | Array<WebElement>
	) {
		this.promise = Promise.resolve(promise)
		this.then = this.promise.then.bind(this.promise)
		this.catch = this.promise.catch.bind(this.promise)
	}

	/** Map in the monadic sense. */
	map(
		fn: (
			elm: Array<WebElement>
		) => Promise<Array<WebElement> | undefined | void>
	) {
		return new Elements(
			this.driver,
			wrapError(
				this.promise.then(async elms => {
					const result = await fn(elms)
					if (Array.isArray(result)) {
						return result
					} else {
						return elms
					}
				})
			)
		)
	}

	waitFor(fn: (elm: Array<WebElement>) => Promise<boolean | object>) {
		return this.map(elm => waitFor(this.driver, () => fn(elm)))
	}

	mapWait(fn: (elm: Array<WebElement>) => Promise<Array<WebElement>>) {
		return this.waitFor(fn).map(fn)
	}

	atIndex(index: number) {
		return new Element(
			this.driver,
			wrapError(
				this.promise.then(elms => {
					const elm = elms[index]
					if (!elm) {
						throw new Error("Element not found!")
					}
					return elm
				})
			)
		)
	}
}

/**
 * Represents a Selenium Browser wrapped in an object with various helper
 * methods.
 */
export class Browser {
	private promise: Promise<void>
	then: Promise<void>["then"]
	catch: Promise<void>["catch"]

	constructor(public driver: ThenableWebDriver, promise?: Promise<void>) {
		this.promise = Promise.resolve(promise)
		this.then = this.promise.then.bind(this.promise)
		this.catch = this.promise.catch.bind(this.promise)
	}

	visit(url: string) {
		return new Browser(
			this.driver,
			wrapError(
				this.promise.then(async () => {
					await this.driver.get(url)
				})
			)
		)
	}

	find(selector: string) {
		return new Element(
			this.driver,
			wrapError(
				this.promise
					.then(() => {
						return waitFor(this.driver, async () =>
							this.driver.findElement(By.css(selector))
						)
					})
					.then(() => {
						return this.driver.findElement(By.css(selector))
					})
			)
		)
	}

	shortcut(modifiers: Array<keyof Omit<IKey, "chord">>, keys: Array<string>) {
		return new Browser(
			this.driver,
			wrapError(
				this.promise.then(async () => {
					const chord = Key.chord(
						...modifiers.map(modifier => Key[modifier]),
						...keys
					)
					await this.driver.findElement(By.tagName("html")).sendKeys(chord)
				})
			)
		)
	}

	getClassName(className: string) {
		return this.find("." + className)
	}

	async clickPoint(point: { x: number; y: number }) {
		await executeScript(this.driver, point, (arg, callback) => {
			const elm = document.elementFromPoint(arg.x, arg.y) as HTMLElement
			if (elm) {
				elm.click()
			}
			callback()
		})
	}

	/**
	 * Find an element with exact text.
	 */
	findText(text: string) {
		return new Element(
			this.driver,
			wrapError(
				this.promise
					.then(() => {
						return waitFor(this.driver, async () =>
							// https://stackoverflow.com/questions/12323403/how-do-i-find-an-element-that-contains-specific-text-in-selenium-webdrive
							// https://github.com/seleniumhq/selenium/issues/3203#issue-193477218
							this.driver.findElement(
								By.xpath(`.//*[contains(text(), '${text}')]`)
							)
						)
					})
					.then(() => {
						return this.driver.findElement(
							By.xpath(`.//*[contains(text(), '${text}')]`)
						)
					})
			)
		)
	}

	waitFor(fn: () => Promise<boolean>, timeout = defaultTimeoutMs) {
		return new Browser(this.driver, waitFor(this.driver, fn))
	}

	waitToLeave(url: string) {
		return new Browser(
			this.driver,
			wrapError(
				waitFor(
					this.driver,
					async () => {
						const currentUrl = await this.driver.getCurrentUrl()
						return url !== currentUrl
					},
					10000
				)
			)
		)
	}

	waitToVisit(url: string) {
		return new Browser(
			this.driver,
			wrapError(
				waitFor(
					this.driver,
					async () => {
						const currentUrl = await this.driver.getCurrentUrl()
						return url === currentUrl
					},
					10000
				)
			)
		)
	}

	/**
	 * GCloud /tmp directory is avaialable.
	 * https://stackoverflow.com/questions/42719793/write-temporary-files-from-google-cloud-function
	 */
	async saveScreenshotPng(filePath: string) {
		await fs.mkdirp(path.dirname(filePath))
		const base64 = await this.driver.takeScreenshot()
		await fs.writeFile(filePath, base64, { encoding: "base64" })
	}
}
