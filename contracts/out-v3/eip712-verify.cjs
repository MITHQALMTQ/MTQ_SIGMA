/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS evidence harness (cited by contracts/TOKEN-STANDARD.md §4); retained byte-for-byte as OD-37/T-88 compile-verification evidence. */
const ethers=require('ethers');
const {TypedDataEncoder,keccak256,toUtf8Bytes,AbiCoder,concat}=ethers;
const coder=new AbiCoder();
(async()=>{
const TYPEHASH=keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'));
const chainId=10143n, addr='0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD';
const solStyle=keccak256(coder.encode(['bytes32','bytes32','bytes32','uint256','address'],[TYPEHASH,keccak256(toUtf8Bytes('MTQ Sigma V3')),keccak256(toUtf8Bytes('1')),chainId,addr]));
const ref=TypedDataEncoder.hashDomain({name:'MTQ Sigma V3',version:'1',chainId,verifyingContract:addr});
console.log('domain sol-style:',solStyle);
console.log('domain ethers ref:',ref);
console.log('DOMAIN MATCH:',solStyle===ref);
const PERMIT_TYPEHASH=keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'));
const owner='0x70997970C51812dc3A010C7d01b50e0d17dc79C8', spender='0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const value=12345678901234567890n, nonce=0n, deadline=9999999999n;
const structHash=keccak256(coder.encode(['bytes32','address','address','uint256','uint256','uint256'],[PERMIT_TYPEHASH,owner,spender,value,nonce,deadline]));
const digest=keccak256(concat(['0x1901',solStyle,structHash]));
const domain={name:'MTQ Sigma V3',version:'1',chainId,verifyingContract:addr};
const refDigest=TypedDataEncoder.hash(domain,{Permit:[{name:'owner',type:'address'},{name:'spender',type:'address'},{name:'value',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]},{owner,spender,value,nonce,deadline});
console.log('PERMIT DIGEST MATCH:',digest===refDigest);
const DEL=keccak256(toUtf8Bytes('Delegation(address delegatee,uint256 nonce,uint256 expiry)'));
const del=addr, dn=5n, de=9999999999n;
const dsH=keccak256(coder.encode(['bytes32','address','uint256','uint256'],[DEL,del,dn,de]));
const ddigest=keccak256(concat(['0x1901',solStyle,dsH]));
const refD=TypedDataEncoder.hash(domain,{Delegation:[{name:'delegatee',type:'address'},{name:'nonce',type:'uint256'},{name:'expiry',type:'uint256'}]},{delegatee:del,nonce:dn,expiry:de});
console.log('DELEGATION DIGEST MATCH:',ddigest===refD);
// end-to-end sign + ecrecover round trip (mirrors contract's ecrecover(digest,v,r,s))
const w=ethers.Wallet.createRandom();
const d2=TypedDataEncoder.hash(domain,{Permit:[{name:'owner',type:'address'},{name:'spender',type:'address'},{name:'value',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]},{owner:w.address,spender,value:1000000000000000000n,nonce:0n,deadline:1099511627776n});
const flat=await w.signingKey.sign(d2);
const v=flat.yParity+27;
console.log('sign+ecrecover round-trip:', ethers.recoverAddress(d2,{v,r:flat.r,s:flat.s})===w.address, ' (v,r,s format as consumed by the contract)');
})().catch(e=>{console.error(e);process.exit(1)});
