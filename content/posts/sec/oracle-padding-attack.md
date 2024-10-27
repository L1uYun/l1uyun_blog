---
date: 2024-07-16
title: oracle-padding-attack
tags:
  - sec
toc: "true"
---
在打tryhackme的New-York-Flankees房间的时候遇见了这个攻击方式,没见过,学习一下
## 前置知识
### 块密码
在分组密码加密领域，数据一次加密一个块，不同算法的块长度各不相同。

当要加密的数据长度不是块长度的倍数时，就需要填充。

高级加密标准 (AES)

数据加密标准 (DES)

三重数据加密标准 (3DES)

Blowfish

Twofish

![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_1.png)
### 填充方案
如前所述，分组密码采用固定大小的块，当明文不是块大小的倍数时需要填充。存在多种填充技术，但在本次攻击中，我们的重点是 PKCS#7。
#### PKCS#7
公钥加密标准 #7 (PKCS#7) 是一种广泛认可的加密标准，它定义了一种填充方案，用于在需要固定块大小的块密码模式中加密之前填充最后一个明文块。

考虑一个情况,块大小为8,需要填充的单词为Exploit,attack,cyber,hack

对于Exploit,需要填充一个字节,所以填充0x01

对于attack,需要填充两个字节,所以填充0x02,0x02

![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_2.png)

另一种情况,正好以及占据了8个字节,就会另起一个块

![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_3.png)

### 块密码模式

分组密码的另一个重要方面是操作模式。

由于分组密码对固定大小的数据块进行操作，因此在处理超过块长度的明文数据时会出现挑战。

各种操作模式解决了这个问题，允许对不同长度的消息进行加密和解密。一些常用的模式包括：

1. Electronic Codebook (ECB) Mode

2. Cipher Block Chaining (CBC) Mode

3. Counter (CTR) Mode 


任何算法都可以采用这些模式；

例如，您可能会遇到 AES-CBC 或 DES-CBC。

在oracle padding中，我们的重点是密码块链接（CBC）模式。

#### CBC
一般来说CBC采用两个操作,一个是加密,一个是异或操作

第一块明文,加密之后与初始向量异或,第二块明文加密之后,与第一块密文相异或...这种方案,即使明文相同,由于初始向量是不同的,密文最终也是不同的
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_4.png)
解密的时候,首先将最后一块密文C\[-1]\,使用解密算法解密,得到伪明文M\[-1\],然后将伪明文M\[-1\]与倒数第二块密文C\[-2\]进行异或,得到明文P\[-1\]

先解密,然后再异或
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_5.png)
### 异或运算
异或操作具有逆运算特性,即已知结果和一个操作数,就能退出来另外一个操作数
```bash
A^B=C    
在等号两边同时异或一个B
=>  A=C^B

在等号两边同时异或一个B
=>  B=C^A
```
## 漏洞检测
当密文值被修改之后,服务器不能正确的恢复明文时,会有报错信息回显出来
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_6.png)

## 攻击原理

这里假设一个情形

假设加密算法为 AES，表示块大小为 16 字节，则初始化向量 (IV) 也是 16 字节。
```bash
if __name__ == '__main__':
    encrypted_data = b'31323334353637383930313233343536f044039223b4b9aea7bc48cd1be80682'
    oracle_padding(ciphertext=encrypted_data)
```
在许多实现中，IV 与消息一起传输。这里假设encrypted_data的前面十六个字节表示IV值,其他值是Cookie

对于每个密文块而言,先将密文解密成伪明文,然后与IV(对于其他的密文块而言,IV就是前面一个密文块)进行异或,得到明文
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_7.png)
这里如果我们修改IV值,就能够改变服务器那边解密出来的明文值,而服务器出现解密失败的话,会有填充错误的信息回显出来,(*这是漏洞产生的条件*)表明服务器检查了解密出来的明文的最后一个字节并将其识别为无效的填充字节。

如果我们尝试对IV进行逐个字节的修改,来让解密之后的明文的填充字节有效(并且我们是知道的),就能逐个字节的解密出来中间的伪明文,最后通过与已知的IV异或,就能得到明文值

```bash
步骤:
初始化：我们从IV的最后一个字节（第16个字节）开始。

逐步修改：将IV的第16个字节增加1，然后发送修改后的密文或IV进行解密。如果服务器返回填充无效错误，继续增加该字节的值。

填充有效：当服务器不再返回填充无效错误时，表示填充是有效的。根据PKCS#7填充规则，这意味着解密后的伪明文的最后一个字节是0x01。

推导明文：通过异或操作推导出密文对应位置的伪明文值。例如，如果IV的最后一个字节是0x35，且解密后伪明文的最后一个字节是0x01，则0x35 ^ 0x01 = 明文的最后一个字节。
```

### 恢复伪明文
我们从 IV 的最后一个字节（IV 的第 16 个字节）开始。将其增加 1，我们重新发送修改后的 cookie 进行解密。再次收到错误，表明填充无效。我们重复这个过程，直到服务器不再发送填充错误。发生这种情况时，表示填充正确，表明明文的最后一个字节的字节值为 0x01.
```bash
Keystream[15] = IV[15] ^ 0x01
Keystream[15] = 0x35 ^ 0x01 = 0x34
```
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_8.png)

接下来，我们对 IV 的倒数第二个字节（IV 的第 15 个字节）重复相同的过程，挑战是相同的，我们需要猜测 IV 值并将它们发送到服务器，直到我们不再遇到填充错误,即填充的字节为0x02。不过，现在不同的是，我们要求明文的最后两个字节是0x02和0x02。

对于最后一个字节，我们已经知道了伪明文的值,可以通过简单的异或运算来解决。
```bash
IV[15] ^ Keystream[15] = 0x02
IV[15] ^ 0x34 = 0x02 => IV[15] = 0x36
```
然而，对于倒数第二个字节，我们需要尝试所有可能的值。从 0x00 开始递增，直到没有错误为止，我们发现 IV 字节是 0x35。
```bash
Keystream[14] = IV[14] ^ 0x02
Keystream[14] = 0x35 ^ 0x02 = 0x37
```
![](https://img.l1uyun.one/202407160948_oracle-padding-attack_image_9.png)
...重复上述过程,直到恢复所有的伪明文
### 恢复明文
第二阶段很简单,我们已经有了原始的IV值,和解密出来的伪明文,直接异或就能得到明文
```bash
Plaintext[15] = IV[15] ^ Keystream[15]
Plaintext[15] = 0x36 ^ 0x34 = 0x2 -> padding no ASCII

Plaintext[14] = IV[14] ^ Keystream[14]
Plaintext[14] = 0x35 ^ 0x37 = 0x2 -> padding no ASCII

Plaintext[13] = IV[13] ^ Keystream[13]
Plaintext[13] = 0x34 ^ 0x15 = 0x21 -> convert to ASCII !
...
```
## 疑惑与解决
密码学还是接触的太少了...

我们假设C1|C2,我们要解密C2,

假设明文P2的最后两个字节是0x02,0x02,即填充字节是2个0x02

C1的最后一个字节C1\[-1\]是0x01,伪明文M2\[-1]是0x01^0x02=0x03

我的疑惑是,如果从0x00开始修改C1\[-1\].会不会在让明文的最后一个字节为0x01之前,提前让解密之后的明文的最后一个字节为0x02,那样子也能够返回填充正确,但是这种情况下我们不能确定明文末尾的填充值.就不能得到伪明文的值了

根据计算
```bash
M2[-1] 0000 0011
C1[-1] 0000 0000  
这里得到的P[-1]是0x03,填充失败

M2[-1] 0000 0011
C1[-1] 0000 0001 
这里得到的P[-1]是0x02,填充成功了...但是我们需要的是0x01时成功
```
但是如果不是从0x00开始修改,而是从他最开始的值+1开始
```bash
M2[-1] 0000 0011
C1[-1] 0000 0010  
最开始是0x01.从加1开始就是0x02了,这样就能确保得到0x01的明文填充值
```
继续假设P2末尾序列是0x03,0x03,0x03

C1\[-1\]的值是0xfa,那么伪明文M2\[-1\]的值就是0xff
```bash
M2[-1] 1111 1111
C1[-1] 1111 1101
从0xfb开始进行枚举  0x02,填充失败
M2[-1] 1111 1111
C1[-1] 1111 1110 
0x01,填充成功
```
我现在的理解是这样的机制,确保了不会提前得到原本的填充值.

密码学让我头大....
# 一句话总结
通过修改IV值的末尾字节,来控制解密之后的明文的末尾字节为填充字节,从而获得中间值,进而获取明文

# 引用
[Oracle Padding Attack](https://medium.com/@masjadaan/oracle-padding-attack-a61369993c86)
[hacktricks_Padding Oracle](https://book.hacktricks.xyz/crypto-and-stego/padding-oracle-priv)