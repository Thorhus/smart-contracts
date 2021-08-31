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
	address _mainBridgeContractAddress;
	address _sideBridgeContractAddress;
	address _oracleAddress;
	string _mainBridgeContractAddressString;
	string _projectAPIToken;
	string _path;
	bytes32 _jobId;
	uint256 _fee;

	bytes32 latestResult;

	// Events
	event RequestFulfilled(bytes32 requestId, bytes32 result);

	modifier onlyChainportSideBridge{
		require(
			msg.sender == _sideBridgeContractAddress,
			"Error: Only ChainportSideBridge can call this function."
		);
		_;
	}

	constructor(
		address chainportCongress_,
		address maintainersRegistry_,
		address mainBridgeContractAddress_,
		address sideBridgeContractAddress_,
		address oracleAddress_,
		string memory projectAPIToken_,
		string memory path_,
		bytes32 jobId_,
		uint256 fee_
	)
	public
	{
		setCongressAndMaintainers(chainportCongress_, maintainersRegistry_);
		setPublicChainlinkToken();
		checkAddress(mainBridgeContractAddress_);
		_mainBridgeContractAddressString = toAsciiString(mainBridgeContractAddress_);
		_mainBridgeContractAddress = mainBridgeContractAddress_;
		checkAddress(sideBridgeContractAddress_);
		_sideBridgeContractAddress = sideBridgeContractAddress_;
		checkAddress(oracleAddress_);
		_oracleAddress = oracleAddress_;
		_projectAPIToken = projectAPIToken_;
		_path = path_;
		_jobId = jobId_;
		_fee = fee_;
	}

	// Setter functions
	// Function to set main bridge contract/proxy address
	function setMainBridgeContractAddress(
		address mainBridgeContractAddress_
	)
	external
	onlyChainportCongress
	{
		checkAddress(mainBridgeContractAddress_);
		_mainBridgeContractAddressString = toAsciiString(mainBridgeContractAddress_);
		_mainBridgeContractAddress = mainBridgeContractAddress_;
	}

	// Function to set side bridge contract/proxy address
	function setSideBridgeContractAddress(
		address sideBridgeContractAddress_
	)
	external
	onlyChainportCongress
	{
		checkAddress(sideBridgeContractAddress_);
		_sideBridgeContractAddress = sideBridgeContractAddress_;
	}

	// Function to set oracle address by congress
	function setOracleAddress(
		address oracleAddress_
	)
	external
	onlyChainportCongress
	{
		checkAddress(oracleAddress_);
		_oracleAddress = oracleAddress_;
	}

	// Function to set project API token
	function setProjectAPIToken(
		string calldata projectAPIToken_
	)
	external
	onlyChainportCongress
	{
		_projectAPIToken = projectAPIToken_;
	}

	// Function to set jobId
	function setJobId(
		bytes32 jobId_
	)
	external
	onlyChainportCongress
	{
		_jobId = jobId_;
	}

	// Function to set fee
	function setFee(
		uint256 fee_
	)
	external
	onlyChainportCongress
	{
		_fee = fee_;
	}

	// Getter function for APIConsumer attributes
	function getAPIConsumerSettings()
	external
	onlyMaintainer
	view
	returns(address, address, address, string memory, string memory, bytes32, uint256)
	{
		return (
			_mainBridgeContractAddress,
			_sideBridgeContractAddress,
			_oracleAddress,
			_projectAPIToken,
			_path,
			_jobId,
			_fee
		);
	}

	// Function to make request for main bridge token supply
	function getMainBridgeTokenSupply(
		address originalTokenAddress
	)
	public
	onlyChainportSideBridge
	returns(bytes32 requestId)
	{
		// Create struct of a request as in chainlink
		Chainlink.Request memory request = buildChainlinkRequest(_jobId, address(this), this.fulfill.selector);

		string memory requestString = string(abi.encodePacked(
			"https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0x",
			toAsciiString(originalTokenAddress),
			"&address=0x",
			_mainBridgeContractAddressString,
			"&tag=latest",
			"&apikey=",
			_projectAPIToken
		));
		// Add string request to struct
		request.add("get", requestString);
		// Define wanted response value path
		request.add("path", _path);

		// Make request and return response
		return sendChainlinkRequestTo(_oracleAddress, request, _fee);
	}

	// Function to make custom request - beware of request being compatible with APIConsumer settings
	function sendCustomGetRequest(
		string calldata requestString,
		string calldata pathString
	)
	external
	onlyMaintainer
	returns(bytes32 requestId)
	{
		// Create request
		Chainlink.Request memory request = buildChainlinkRequest(_jobId, address(this), this.fulfill.selector);
		// Add request method and path of result
		request.add("get", requestString);
		request.add("path", pathString);

		// Send request
		return sendChainlinkRequestTo(_oracleAddress, request, _fee);
	}

	// Function to call on request response
	function fulfill(bytes32 _requestId, bytes32 _result) public recordChainlinkFulfillment(_requestId) {
		latestResult = _result;
		emit RequestFulfilled(_requestId, _result);
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
