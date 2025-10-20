---
title: springboot利用
tags:
  - sec
date: 2024-08-06T09:32:00
lastmod: 2025-09-29T20:53:09
toc: "true"
---
# springboot利用

# 前置知识

## SpringBoot Actuator
```bash
Spring Boot Actuator 1.x 版本默认内置路由的起始路径为 / ，2.x 版本则统一以 /actuator 为起始路径
Spring Boot Actuator 默认的内置路由名字，如 /env 有时候也会被程序员修改，比如修改成 /appenv
```
一般来讲，暴露出 spring boot 应用的相关接口和传参信息并不能算是漏洞，但是以 “默认安全” 来讲，不暴露出这些信息更加安全。

对于攻击者来讲，一般会仔细审计暴露出的接口以增加对业务系统的了解，并会同时检查应用系统是否存在未授权访问、越权等其他业务类型漏洞。
## 配置不当而暴露的路由
主要是因为程序员开发时没有意识到暴露路由可能会造成安全风险，或者没有按照标准流程开发，忘记上线时需要修改/切换生产环境的配置

因为配置不当而暴露的默认内置路由可能会有：
```bash
/actuator
/auditevents
/autoconfig
/beans
/caches
/conditions
/configprops
/docs
/dump
/env
/flyway
/health
/heapdump
/httptrace
/info
/intergrationgraph
/jolokia
/logfile
/loggers
/liquibase
/metrics
/mappings
/prometheus
/refresh
/scheduledtasks
/sessions
/shutdown
/trace
/threaddump
/actuator/auditevents
/actuator/beans
/actuator/health
/actuator/conditions
/actuator/configprops
/actuator/env
/actuator/info
/actuator/loggers
/actuator/heapdump
/actuator/threaddump
/actuator/metrics
/actuator/scheduledtasks
/actuator/httptrace
/actuator/mappings
/actuator/jolokia
/actuator/hystrix.stream
```
其中对寻找漏洞比较重要接口的有：

/env、/actuator/env
GET 请求 /env 会直接泄露环境变量、内网地址、配置中的用户名等信息；当程序员的属性名命名不规范，例如 password 写成 psasword、pwd 时，会泄露密码明文；

同时有一定概率可以通过 POST 请求 /env 接口设置一些属性，间接触发相关 RCE 漏洞；同时有概率获得星号遮掩的密码、密钥等重要隐私信息的明文。

/refresh、/actuator/refresh
POST 请求 /env 接口设置属性后，可同时配合 POST 请求 /refresh 接口刷新属性变量来触发相关 RCE 漏洞。

/restart、/actuator/restart
暴露出此接口的情况较少；可以配合 POST请求 /env 接口设置属性后，再 POST 请求 /restart 接口重启应用来触发相关 RCE 漏洞。

/jolokia、/actuator/jolokia
可以通过 /jolokia/list 接口寻找可以利用的 MBean，间接触发相关 RCE 漏洞、获得星号遮掩的重要隐私信息的明文等。

/trace、/actuator/httptrace
一些 http 请求包访问跟踪信息，有可能在其中发现内网应用系统的一些请求信息详情；以及有效用户或管理员的 cookie、jwt token 等信息。


## 漏洞检测

### 检测清单
https://github.com/LandGrey/SpringBootVulExploit
![](https://img.l1uyun.one/javasec-springboot框架利用_image_1.png)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_2.png)

### 黑盒发现
人工识别，BP插件

人工识别
1、网站图片文件是一个绿色的树叶。2、特有的报错信息。3、Whitelabel Error Page关键字
![|750](https://img.l1uyun.one/javasec-springboot框架利用_image_3.png)

BP插件
https://github.com/API-Security/APIKit
打开BurpSuite页面,点击Extender然后选择Extensions,添加APIKit.jar
![](https://img.l1uyun.one/javasec-springboot框架利用_image_4.png)
安装好插件后啥都不用管，让数据包经过BP即可触发插件被动扫描
![|800](https://img.l1uyun.one/javasec-springboot框架利用_image_5.png)

### 白盒发现
pom.xml,引用库
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```
配置文件Actuator设置全部暴露`management.endpoints.web.exposure.include=*`
![](https://img.l1uyun.one/javasec-springboot框架利用_image_6.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_7.png)


## 信息泄露利用
### 内部路由泄露
https://github.com/AabyssZG/SpringBoot-Scan
![](https://img.l1uyun.one/javasec-springboot框架利用_image_8.png)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_9.png)

### heapdump敏感信息查询
配置密码，AK/SK等

![|800](https://img.l1uyun.one/javasec-springboot框架利用_image_10.png)

下载下来
![](https://img.l1uyun.one/javasec-springboot框架利用_image_11.png)
然后使用JDumpSPider工具来获取数据
![](https://img.l1uyun.one/javasec-springboot框架利用_image_12.png)

![](https://img.l1uyun.one/Pasted image 20240806101506.png)

这里还有另外一款工具,支持关键词搜索
https://github.com/wyzxxz/heapdump_tool
![|750](https://img.l1uyun.one/javasec-springboot框架利用_image_14.png)

![|850](https://img.l1uyun.one/javasec-springboot框架利用_image_15.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_16.png)

## 漏洞利用
### 框架漏洞
https://github.com/AabyssZG/SpringBoot-Scan
![](https://img.l1uyun.one/javasec-springboot框架利用_image_17.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_18.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_19.png)

### 利用类漏洞来进行RCE攻击
服务器上执行JNDIExploit工具(可以本地、也可以远程VPS上运行)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_20.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_21.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_22.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_23.png)



# CMS源码审计

## 安装源码
![](https://img.l1uyun.one/javasec-springboot框架利用_image_24.png)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_25.png)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_26.png)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_27.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_28.png)

![](https://img.l1uyun.one/javasec-springboot框架利用_image_29.png)
起始就是把actuator的接口做了可视化
![](https://img.l1uyun.one/javasec-springboot框架利用_image_30.png)

## 源码审计
从pom.xml看有没有调用Actuator库
![](https://img.l1uyun.one/javasec-springboot框架利用_image_31.png)
```xml
配置文件中Actuator设置是否为*(全部暴露)
management.endpoints.web.exposure.include=*
```
![|700](https://img.l1uyun.one/javasec-springboot框架利用_image_32.png)

![|700](https://img.l1uyun.one/javasec-springboot框架利用_image_33.png)

泄露安全(heapdump)
![](https://img.l1uyun.one/javasec-springboot框架利用_image_34.png)
使用heapdump敏感信息查询工具提取敏感信息
JDumpSpider
![|750](https://img.l1uyun.one/javasec-springboot框架利用_image_35.png)
# 一句话总结
遇到springboot框架从两个方面去寻找安全问题：
1.泄露安全(是否泄露了内部路由及heapdump)
2.漏洞安全(利用相关框架漏洞检测工具测试是否存在漏洞)



# 参考
[WEB攻防-Java安全&原生反序列化&SpringBoot攻防&heapdump提取&CVE\_java spring反序列化-CSDN博客](https://blog.csdn.net/m0_60571842/article/details/135096224)