import { EC2 } from "aws-sdk"

export async function buildVpc(
	ec2: EC2
): Promise<{ vpcId: string; subnetId: string }> {
	const vpc = await createVpc(ec2)
	const [subnet, igw] = await Promise.all([
		addSubnetToVpc(ec2, vpc),
		addInternetGatewayToVpc(ec2, vpc)
	])
	const routeTable = await addRouteTableToSubnet(ec2, vpc, subnet)
	await addInternetGatewayToRouteTable(ec2, igw, routeTable)

	return {
		vpcId: vpc,
		subnetId: subnet
	}
}

export const createVpc = (ec2: EC2) =>
	new Promise<string>((resolve, reject) => {
		ec2.createVpc(
			{
				CidrBlock: "10.0.0.0/16"
			},
			(err, data) => {
				if (err || !data.Vpc || !data.Vpc.VpcId) {
					reject(err)
				} else {
					resolve(data.Vpc.VpcId)
					ec2.createTags({
						Resources: [data.Vpc.VpcId],
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
	})

const addSubnetToVpc = (ec2: EC2, vpc: string) =>
	new Promise<string>((resolve, reject) => {
		ec2.createSubnet(
			{
				VpcId: vpc,
				CidrBlock: "10.0.0.0/16"
			},
			(err, data) => {
				if (err || !data.Subnet || !data.Subnet.SubnetId) {
					reject(err)
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
				reject(err)
			} else {
				const igw = data.InternetGateway.InternetGatewayId
				ec2.attachInternetGateway(
					{
						InternetGatewayId: igw,
						VpcId: vpc
					},
					err => {
						if (err) {
							reject(err)
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
					reject(err)
				} else {
					const routeTable = data.RouteTable.RouteTableId
					ec2.associateRouteTable(
						{
							RouteTableId: routeTable,
							SubnetId: subnet
						},
						err => {
							if (err) {
								reject(err)
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
) =>
	new Promise<void>((resolve, reject) => {
		ec2.createRoute(
			{
				DestinationCidrBlock: "0.0.0.0/0",
				GatewayId: igw,
				RouteTableId: routeTable
			},
			err => {
				if (err) {
					reject(err)
				} else {
					resolve()
				}
			}
		)
	})
