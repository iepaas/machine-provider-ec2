import { AWSError } from "aws-sdk"

export function createError(err: AWSError, occurredWhen: string) {
	const base = err || new Error("createError didn't receive an error!")
	const error = Object.assign({ occurredWhen }, base)
	Object.setPrototypeOf(error, Object.getPrototypeOf(base))
	return error
}
