//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

interface IChainportExchange{
	function getTokenValueInUsd(uint amount, address token) external view returns(uint [] memory amounts);
}
