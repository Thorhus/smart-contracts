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
	bytes32 _jobId;
	uint256 _fee;

	bytes32 private latestResult;

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
		string memory jobId_,
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
		_jobId = stringToBytes32(jobId_);
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
		string memory jobId_
	)
	external
	onlyChainportCongress
	{
		_jobId = stringToBytes32(jobId_);
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
	returns(address, address, address, string memory, bytes32, uint256)
	{
		return (
			_mainBridgeContractAddress,
			_sideBridgeContractAddress,
			_oracleAddress,
			_projectAPIToken,
			_jobId,
			_fee
		);
	}

	// Function to get latestResult
	function getLatestResult()
	external
	onlyChainportSideBridge
	view
	returns(bytes32){
		return latestResult;
	}

	// Function to make request for main bridge token supply
	function getMainBridgeTokenSupply(
		address originalTokenAddress
	)
	external
	onlyChainportSideBridge
	returns(bytes32)
	{
		// Create request suitable for getting token supply from Etherscan API
		string memory requestString = string(abi.encodePacked(
			"https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0x",
			toAsciiString(originalTokenAddress),
			"&address=0x",
			_mainBridgeContractAddressString,
			"&tag=latest",
			"&apikey=",
			_projectAPIToken
		));
		// Make request
		return _makeRequest(requestString, "result", "get");
	}

	// Function to make custom request - beware of request being compatible with APIConsumer settings
	function sendCustomRequestByMaintainer(
		string calldata requestString,
		string calldata pathString,
		string calldata method
	)
	external
	onlyMaintainer
	returns(bytes32)
	{
		// Make request
		return _makeRequest(requestString, pathString, method);
	}

	// Core function used for making requests
	function _makeRequest(
		string memory requestString,
		string memory pathString,
		string memory method
	)
	internal
	returns(bytes32)
	{
		// Create request struct
		Chainlink.Request memory request = buildChainlinkRequest(_jobId, address(this), this.fulfill.selector);
		// Call method and request
		request.add(method, requestString);
		// Add path / path should be separated with "."
		request.add("path", pathString);

		// Send request
		return sendChainlinkRequestTo(_oracleAddress, request, _fee);
	}

	// Function to call on request response
	function fulfill(bytes32 _requestId, bytes32 _result) public recordChainlinkFulfillment(_requestId) {
		// Request response value (from path) is always stored in latestResult
		latestResult = _result;
		emit RequestFulfilled(_requestId, _result);
	}

	// Function to convert address type hex value to string
	function toAsciiString(address x) internal pure returns (string memory) {
		// Allocate memory for string to return
		bytes memory s = new bytes(40);
		for (uint i = 0; i < 20; i++) {
			// Isolating a single byte 10110110 /-/ uint160 -> 20bytes -> address has 40 nibble's
			// 2^8 -> uint8/single byte /-/ 19 -> 0..19 -> 20 bytes
			// Uint8 takes first byte of the value calculated by division / bytes1 converts it to byte type
			bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
			// Get first nibble hex (higher)
			bytes1 hi = bytes1(uint8(b) / 16);
			// Get second nibble hex (lower)
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
	function char(bytes1 b) internal pure returns (bytes1) {
		// If is a number add it 0x30 to equalize ascii value
		// If not a number add start of lower letters - 10 from ascii (0x67-0xA=0x57)
		if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
		else return bytes1(uint8(b) + 0x57);
	}

	// Function to convert string to bytes32
	function stringToBytes32(string memory s) internal pure returns (bytes32 result) {
		// If byte is empty return 0x0
		if(bytes(s).length == 0) {
			return 0x0;
		}
		// Assembly convert result to bytes32
		assembly {
			result := mload(add(s, 32))
		}
	}

	// Function to check the addresses
	function checkAddress(address addressToCheck) internal pure {
		require(addressToCheck != address(0), "Error: Address is malformed.");
	}
}
