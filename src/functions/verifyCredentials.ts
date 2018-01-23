import { EC2 } from "aws-sdk"
import { createError } from "../support/AWSProviderError"

export const verifyCredentials = (ec2: EC2) =>
	new Promise<boolean>((resolve, reject) => {
		ec2.describeInstances(err => {
			if (err) {
				if (err.code === "AuthFailure") {
					resolve(false)
				} else {
					reject(createError(err, "Trying to verify credentials"))
				}
			} else {
				resolve(true)
			}
		})
	})
