import { AWSError } from "aws-sdk"

export function createError(base: AWSError, occurredWhen: string) {
	const error = Object.assign({ occurredWhen }, base)
	Object.setPrototypeOf(error, Object.getPrototypeOf(base))
	return error
}
