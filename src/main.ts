import { Request, Response } from "express"

/**
 * The name of this export must match the `--entry-point` option in
 * the deploy script.
 */
export default function main(req: Request, res: Response) {
	res.status(200).send("hello world")
}
