import { Client as SSHClient } from "ssh2"
import { Machine } from "@iepaas/machine-provider-abstract"
import { CommandResult } from "../interfaces/CommandResult"
import {
	SSH_MAX_ATTEMPTS,
	SSH_READY_TIMEOUT_MILLISECONDS,
	SSH_RETRY_DELAY_MILLISECONDS
} from "../config"

export async function executeCommandsInMachine(
	commands: Array<string>,
	machine: Machine,
	keyPair: string
): Promise<void> {
	const connection = await initConnection(machine, keyPair)

	for (const command of commands) {
		const result = await sendCommand(connection, command)
		if (result.exitCode !== 0) {
			throw new Error(`Command ${command} exited with non-zero code!
			${JSON.stringify(result)}`)
		}
	}

	connection.end()
}

const initConnection = (
	machine: Machine,
	keyPair: string,
	currentAttempt: number = 1
) =>
	new Promise<SSHClient>((resolve, reject) => {
		const client = new SSHClient()

		client
			.on("ready", () => {
				resolve(client)
			})
			.on("error", err => {
				if (currentAttempt === SSH_MAX_ATTEMPTS) {
					reject(err)
				} else {
					setTimeout(() => {
						initConnection(machine, keyPair, currentAttempt + 1)
							.then(resolve)
							.catch(reject)
					}, SSH_RETRY_DELAY_MILLISECONDS)
				}
			})
			.connect({
				host: machine.address,
				username: "ubuntu",
				privateKey: keyPair,
				readyTimeout: SSH_READY_TIMEOUT_MILLISECONDS
			})
	})

const sendCommand = (connection: SSHClient, command: string) =>
	new Promise<CommandResult>((resolve, reject) => {
		connection.exec(command, (err, stream) => {
			let stdout = "",
				stderr = ""
			if (err) {
				reject(err)
			} else {
				stream
					.on("close", (exitCode: number) => {
						resolve({
							exitCode,
							stdout,
							stderr
						})
					})
					.on("data", (data: Buffer) => {
						stdout += data.toString()
					})
					.stderr.on("data", (data: Buffer) => {
						stderr += data.toString()
					})
			}
		})
	})
