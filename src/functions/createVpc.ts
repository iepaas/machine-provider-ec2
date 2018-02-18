import { EC2 } from "aws-sdk"
import { createError } from "../support/AWSProviderError"

interface Vpc {
	id: string
	IPv6Cidr: string
}

export async function buildVpc(
	ec2: EC2
): Promise<{ vpcId: string; subnetIds: Array<string> }> {
	const [vpc, zones] = await Promise.all([
		createVpc(ec2),
		getAvailabilityZones(ec2)
	])

	const [igw, ...subnets] = await Promise.all([
		addInternetGatewayToVpc(ec2, vpc.id),
		...zones.map((zone, i) => addSubnetToVpc(ec2, vpc, zone, i))
	])

	const routeTables = await Promise.all(
		subnets.map(it => addRouteTableToSubnet(ec2, vpc.id, it))
	)
	await Promise.all(
		routeTables.map(it => addInternetGatewayToRouteTable(ec2, igw, it))
	)

	return {
		vpcId: vpc.id,
		subnetIds: subnets
	}
}

const createVpc = (ec2: EC2) =>
	new Promise<Vpc>((resolve, reject) => {
		ec2.createVpc(
			{
				CidrBlock: "10.0.0.0/16",
				AmazonProvidedIpv6CidrBlock: true
			},
			(err, data) => {
				if (err || !data.Vpc || !data.Vpc.VpcId) {
					reject(createError(err, "Trying to create a VPC"))
				} else {
					ec2.waitFor(
						"vpcAvailable",
						{
							VpcIds: [data.Vpc.VpcId]
						},
						(err, data) => {
							if (
								err ||
								!data.Vpcs ||
								!data.Vpcs[0] ||
								!data.Vpcs[0].VpcId ||
								!data.Vpcs[0].Ipv6CidrBlockAssociationSet ||
								!data.Vpcs[0].Ipv6CidrBlockAssociationSet![0] ||
								!data.Vpcs[0].Ipv6CidrBlockAssociationSet![0].Ipv6CidrBlock
							) {
								reject(createError(err, "Trying to create a VPC"))
							} else {
								resolve({
									id: data.Vpcs[0].VpcId!,
									IPv6Cidr: data.Vpcs[0].Ipv6CidrBlockAssociationSet![0]
										.Ipv6CidrBlock!
								})
								ec2.createTags({
									Resources: [data.Vpcs[0].VpcId!],
									Tags: [
										{
											Key: "Name",
											Value: "iepaas VPC"
										}
									]
								})
							}
						}
					)
				}
			}
		)
	})

export const getAvailabilityZones = (ec2: EC2) =>
	new Promise<Array<string>>((resolve, reject) =>
		ec2.describeAvailabilityZones((err, data) => {
			if (err || !data.AvailabilityZones) {
				reject(createError(err, "Trying to get the AWS Availability Zones"))
			} else {
				resolve(data.AvailabilityZones.map(it => it.ZoneName!))
			}
		})
	)

const addSubnetToVpc = (
	ec2: EC2,
	vpc: Vpc,
	availabilityZone: string,
	zoneIndex: number
) =>
	new Promise<string>((resolve, reject) => {
		const CIDR_REGEX = /(.+):(.+):(.+):(.+)00::\/56/
		const p = vpc.IPv6Cidr.match(CIDR_REGEX)

		if (p === null) {
			return reject(new Error(`Cannot parse ${CIDR_REGEX}`))
		}

		const Ipv6CidrBlock = `${p[1]}:${p[2]}:${p[3]}:${p[4]}0${zoneIndex}::/64`

		ec2.createSubnet(
			{
				VpcId: vpc.id,
				CidrBlock: `10.0.${zoneIndex * 16}.0/20`,
				Ipv6CidrBlock,
				AvailabilityZone: availabilityZone
			},
			(err, data) => {
				if (err || !data.Subnet || !data.Subnet.SubnetId) {
					reject(createError(err, "Trying to add a subnet"))
				} else {
					resolve(data.Subnet.SubnetId)
				}
			}
		)
	})

const addInternetGatewayToVpc = (ec2: EC2, vpc: string) =>
	new Promise<string>((resolve, reject) => {
		ec2.createInternetGateway((err, data) => {
			if (
				err ||
				!data.InternetGateway ||
				!data.InternetGateway.InternetGatewayId
			) {
				reject(createError(err, "Trying to create an internet gateway"))
			} else {
				const igw = data.InternetGateway.InternetGatewayId
				ec2.attachInternetGateway(
					{
						InternetGatewayId: igw,
						VpcId: vpc
					},
					err => {
						if (err) {
							reject(
								createError(
									err,
									"Trying to attach an internet gateway to an VPC"
								)
							)
						} else {
							resolve(igw)
						}
					}
				)
			}
		})
	})

const addRouteTableToSubnet = (ec2: EC2, vpc: string, subnet: string) =>
	new Promise<string>((resolve, reject) => {
		ec2.createRouteTable(
			{
				VpcId: vpc
			},
			(err, data) => {
				if (err || !data.RouteTable || !data.RouteTable.RouteTableId) {
					reject(createError(err, "Trying to create a route table"))
				} else {
					const routeTable = data.RouteTable.RouteTableId
					ec2.associateRouteTable(
						{
							RouteTableId: routeTable,
							SubnetId: subnet
						},
						err => {
							if (err) {
								reject(
									createError(
										err,
										"Trying to associate a route table to a subnet"
									)
								)
							} else {
								resolve(routeTable)
							}
						}
					)
				}
			}
		)
	})

const addInternetGatewayToRouteTable = (
	ec2: EC2,
	igw: string,
	routeTable: string
) => {
	const sendRequest = (params: {
		DestinationCidrBlock?: string
		DestinationIpv6CidrBlock?: string
	}) =>
		new Promise<void>((resolve, reject) => {
			ec2.createRoute(
				{
					GatewayId: igw,
					RouteTableId: routeTable,
					...params
				},
				err => {
					if (err) {
						reject(
							createError(
								err,
								"Trying to add an internet gateway to a route table"
							)
						)
					} else {
						resolve()
					}
				}
			)
		})

	return Promise.all([
		sendRequest({ DestinationCidrBlock: "0.0.0.0/0" }),
		sendRequest({ DestinationIpv6CidrBlock: "::/0" })
	])
}
