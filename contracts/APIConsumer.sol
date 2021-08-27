//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";
import "./ChainportMiddleware.sol";

/*
 * @author: Marko Lazic
 * Github: markolazic01
 * Date: 27.8.21.
 */

contract APIConsumer is ChainlinkClient, ChainportMiddleware {

	// Global state variables
	address private mainBridgeContractEthereum;
	address private oracleAddress;
	string private projectAPIToken;
	bytes32 private jobId;
	uint256 private fee;

	// Events
	event RequestFulfilled(bool);

	constructor(
		address _chainportCongress,
		address _maintainersRegistry,
		address _mainBridgeContractEthereum,
		address _oracleAddress,
		string memory _projectAPIToken,
		bytes32 _jobId,
		uint256 _fee
	)
	public
	{
		setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
		setPublicChainlinkToken();
		checkAddress(_mainBridgeContractEthereum);
		mainBridgeContractEthereum = _mainBridgeContractEthereum;
		checkAddress(_oracleAddress);
		oracleAddress = _oracleAddress;
		projectAPIToken = _projectAPIToken;
		jobId = _jobId;
		fee = _fee;
	}

	// Setter functions
	// Function to set main bridge contract/proxy address
	function setMainBridgeContractEthereum(
		address _mainBridgeContractEthereum
	)
	external
	onlyChainportCongress
	{
		checkAddress(_mainBridgeContractEthereum);
		mainBridgeContractEthereum = _mainBridgeContractEthereum;
	}

	// Function to set oracle address by congress
	function setOracleAddress(
		address _oracleAddress
	)
	external
	onlyChainportCongress
	{
		checkAddress(_oracleAddress);
		oracleAddress = _oracleAddress;
	}

	// Function to set project API token
	function setProjectAPIToken(
		string calldata _projectAPIToken
	)
	external
	onlyChainportCongress
	{
		projectAPIToken = _projectAPIToken;
	}

	// Function to set jobId
	function setJobId(
		bytes32 _jobId
	)
	external
	onlyChainportCongress
	{
		jobId = _jobId;
	}

	// Function to set fee
	function setFee(
		uint256 _fee
	)
	external
	onlyChainportCongress
	{
		fee = _fee;
	}

	// Getter function for private contract attributes
	function getAPIConsumerSettings()
	external
	onlyMaintainer
	returns(address, address, string memory, bytes32, uint256)
	{
		return (
			mainBridgeContractEthereum,
			oracleAddress,
			projectAPIToken,
			jobId,
			fee
		);
	}

	// Function to make request for main bridge token supply
	function getMainBridgeTokenSupply(
		address originalToken
	)
	public
	onlyMaintainer
	returns(bytes32 requestId)
	{
		// Create struct of a request as in chainlink
		Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);

		string memory requestString = string(abi.encodePacked(
			"https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=",
			toAsciiString(mainBridgeContractEthereum),
			"&address=",
			toAsciiString(originalToken),
			"&tag=latest",
			"&apikey=",
			projectAPIToken
		));
		// Add string request to struct
		request.add("get", requestString);
		// Define wanted response value path
		request.add("path", "result");

		// Make request and return response
		return sendChainlinkRequestTo(oracleAddress, request, fee);
	}

	// Function to call on request response
	function fulfill(bytes32 _requestId) public recordChainlinkFulfillment(_requestId) {
		emit RequestFulfilled(true);
	}

	// Function to convert address type hex value to string
	function toAsciiString(address x) internal pure returns (string memory) {
		// Allocate memory for string to return
		bytes memory s = new bytes(40);
		for (uint i = 0; i < 20; i++) {
			// Isolating a single byte 10110110
			bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
			// Get first nibble hex
			bytes1 hi = bytes1(uint8(b) / 16);
			// Get second nibble hex
			bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
			// Multiplying by 2 because every byte is 2 chars
			// Set first char in the set of 2
			s[2*i] = char(hi);
			// Set second char in a set of 2
			s[2*i+1] = char(lo);
		}
		return string(s);
	}

	// Turn single byte to ascii char
	function char(bytes1 b) internal pure returns (bytes1 c) {
		// If is a number add it 0x30 to equalize ascii value
		// If not a number add start of lower letters - 10 from ascii (0x67-0xA=0x57)
		if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
		else return bytes1(uint8(b) + 0x57);
	}

	// Function to check the addresses
	function checkAddress(address addressToCheck) internal pure {
		require(addressToCheck != address(0), "Error: Address is malformed.");
	}
}
