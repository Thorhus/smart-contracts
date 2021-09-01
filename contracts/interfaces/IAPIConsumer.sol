pragma solidity ^0.6.12;

/*
 * @author: Marko Lazic
 * Github: markolazic01
 * Date: 1.9.21.
 */
interface IAPIConsumer {
	function getMainBridgeTokenSupply(address originalTokenAddress) external returns(bytes32);
	function getLatestResult() external view returns(bytes32);
}
