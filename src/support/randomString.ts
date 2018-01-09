import { randomBytes } from "crypto"

export function randomString(length: number = 10) {
	return randomBytes(Math.floor(length / 2))
		.toString("hex")
		.substr(0, length)
}
