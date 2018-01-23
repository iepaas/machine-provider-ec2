import * as AWS from "aws-sdk"
import {
	FilledUserPrompt,
	UserPrompt
} from "@iepaas/resource-provider-abstract"
import {
	AbstractMachineProvider,
	Snapshot,
	Machine,
	MachineType
} from "@iepaas/machine-provider-abstract"
import { AbstractKeyValueStore } from "@iepaas/abstract-key-value-store"
import { createMachine } from "./functions/createMachine"
import { destroyMachine } from "./functions/destroyMachine"
import { createSecurityGroup } from "./functions/createSecurityGroup"
import {
	ACCESS_KEY_ID,
	BUILD_MACHINE_SIZE,
	CHILD_MACHINE_SIZE,
	PARENT_MACHINE_SIZE,
	REGION,
	REPO_URL,
	SECRET_ACCESS_KEY,
	SECURITY_GROUP_BUILD_ID,
	SECURITY_GROUP_CHILD_ID,
	SECURITY_GROUP_PARENT_ID,
	SUBNET_ID,
	VPC_ID
} from "./configKeys"
import { buildVpc } from "./functions/createVpc"
import { allocateElasticIp } from "./functions/allocateElasticIp"
import { takeSnapshotOfMachine } from "./functions/takeSnapshotOfMachine"
import { deleteSnapshotOfMachine } from "./functions/deleteSnapshotOfMachine"
import { AWS_REGIONS } from "./resources/awsRegions"
import { getInstanceName } from "./support/getInstanceName"
import { EC2_INSTANCE_SIZES } from "./resources/ec2InstanceSizes"
import { getInstanceSize } from "./support/getInstanceSize"
import { verifyCredentials } from "./functions/verifyCredentials"

export class EC2MachineProvider extends AbstractMachineProvider {
	// noinspection JSUnusedGlobalSymbols
	protected providerName = "iepaas/machine-provider-ec2"

	private ec2?: AWS.EC2

	constructor(appName: string, store: AbstractKeyValueStore) {
		super(appName, store)
	}

	public async registerPrompts(): Promise<Array<UserPrompt>> {
		return [
			{
				name: "accessKeyId",
				type: "text",
				required: true
			},
			{
				name: "secretAccessKey",
				type: "password",
				required: true
			},
			{
				name: "region",
				type: "select",
				required: true,
				choices: AWS_REGIONS
			},
			{
				name: "parentMachineSize",
				type: "select",
				required: true,
				choices: EC2_INSTANCE_SIZES
			},
			{
				name: "buildMachineSize",
				type: "select",
				required: true,
				choices: EC2_INSTANCE_SIZES
			},
			{
				name: "childMachineSize",
				type: "select",
				required: true,
				choices: EC2_INSTANCE_SIZES
			}
		]
	}

	public async init(prompts: Array<FilledUserPrompt>) {
		const get = (name: string) => {
			const prompt = prompts.find(it => it.name === name)
			if (!prompt) {
				throw new Error(`The prompt ${name} is not defined!`)
			}
			return prompt.value
		}

		await Promise.all([
			this.setConfigValue(REPO_URL, get("repoUrl")),
			this.setConfigValue(ACCESS_KEY_ID, get("accessKeyId")),
			this.setConfigValue(SECRET_ACCESS_KEY, get("secretAccessKey")),
			this.setConfigValue(REGION, get("region")),
			this.setConfigValue(PARENT_MACHINE_SIZE, get("parentMachineSize")),
			this.setConfigValue(CHILD_MACHINE_SIZE, get("childMachineSize")),
			this.setConfigValue(BUILD_MACHINE_SIZE, get("buildMachineSize"))
		])
	}

	private async getEC2() {
		if (!this.ec2) {
			const [accessKeyId, secretAccessKey, region] = await Promise.all([
				this.getConfigValue(ACCESS_KEY_ID),
				this.getConfigValue(SECRET_ACCESS_KEY),
				this.getConfigValue(REGION)
			])

			if (!(accessKeyId && secretAccessKey && region)) {
				throw new Error(
					"Either the aws access key id, the secret, or" +
						" the region are missing!"
				)
			}

			const awsCredentials = new AWS.Credentials(accessKeyId, secretAccessKey)

			AWS.config.update({
				credentials: awsCredentials,
				region: region
			})

			this.ec2 = new AWS.EC2({ apiVersion: "2016-11-15" })
		}

		return this.ec2
	}

	public async buildIepaasInfrastructure() {
		const { vpcId, subnetId } = await buildVpc(await this.getEC2())
		await Promise.all([
			this.setConfigValue(VPC_ID, vpcId),
			this.setConfigValue(SUBNET_ID, subnetId)
		])

		const [parentSg, eip] = await Promise.all([
			createSecurityGroup(
				await this.getEC2(),
				vpcId,
				"iepaas-parent",
				"iepaas parent machine",
				[80, 443, 3000, 4898]
			),
			allocateElasticIp(await this.getEC2())
		])

		const [buildSg, childSg] = await Promise.all([
			createSecurityGroup(
				await this.getEC2(),
				vpcId,
				"iepaas-build",
				"iepaas build machine",
				[3000],
				[eip.address]
			),
			createSecurityGroup(
				await this.getEC2(),
				vpcId,
				"iepaas-child",
				"iepaas child machine",
				[{ from: 3000, to: 4000 }],
				[eip.address]
			)
		])

		await Promise.all([
			this.setConfigValue(SECURITY_GROUP_PARENT_ID, parentSg),
			this.setConfigValue(SECURITY_GROUP_BUILD_ID, buildSg),
			this.setConfigValue(SECURITY_GROUP_CHILD_ID, childSg)
		])

		return await createMachine(await this.getEC2(), {
			subnetId,
			securityGroupId: parentSg,
			appName: this.appName,
			machineName: "iepaas parent",
			size: (await this.getConfigValue(PARENT_MACHINE_SIZE))!,
			initCommands: [
				"curl -o- https://raw.githubusercontent.com/iepaas/iepaas/master/install.sh | bash",
				"cd /iepaas && npm run set-machine-provider @iepaas/machine-provider-ec2",
				...(await this.getAllConfigValues()).map(
					it => `cd /iepaas && npm run set-config ${it.key} ${it.value}`
				),
				"sudo chown -R ubuntu:ubuntu /iepaas"
			],
			postInitCommands: [
				`cd /iepaas && npm run set-repo-url ${await this.getConfigValue(
					REPO_URL
				)}`
			],
			elasticIpAllocationId: eip.allocationId
		})
	}

	public async createMachine(
		type: MachineType,
		initCommands: Array<string>,
		snapshot?: Snapshot
	): Promise<Machine> {
		return createMachine(await this.getEC2(), {
			appName: this.appName,
			machineName: getInstanceName(type),
			size: await getInstanceSize(type, this.getConfigValue.bind(this)),
			subnetId: (await this.getConfigValue(SUBNET_ID))!,
			securityGroupId: (await this.getConfigValue(
				(() => {
					switch (type) {
						case MachineType.BUILD:
							return SECURITY_GROUP_BUILD_ID
						case MachineType.PARENT:
							return SECURITY_GROUP_PARENT_ID
						case MachineType.CHILD:
							return SECURITY_GROUP_CHILD_ID
					}
				})()
			))!,
			initCommands,
			snapshot
		})
	}

	public async destroyMachine(machine: Machine): Promise<void> {
		return await destroyMachine(await this.getEC2(), machine)
	}

	public async takeSnapshot(machine: Machine): Promise<Snapshot> {
		return await takeSnapshotOfMachine(await this.getEC2(), machine)
	}

	public async deleteSnapshot(snapshot: Snapshot): Promise<void> {
		return await deleteSnapshotOfMachine(await this.getEC2(), snapshot)
	}

	public async verifyCredentials(): Promise<boolean> {
		return await verifyCredentials(await this.getEC2())
	}
}
