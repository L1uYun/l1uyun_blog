---
title: javasec-xxe
date: 2024-07-26T18:10:32
lastmod: 2025-09-29T20:53:20
tags:
  - sec
toc: "true"
---
# xxe注入
## 前置知识
### XML文档
要了解XXE漏洞，那么先得了解一下有关XML的基础知识。

XML是一种非常流行的标记语言，在1990年代后期首次标准化，并被无数的软件项目所采用。它用于配置文件，文档格式（如OOXML，ODF，PDF，RSS，...），图像格式（SVG，EXIF标题）和网络协议（WebDAV，CalDAV，XMLRPC，SOAP，XMPP，SAML， XACML，...）
#### 文档结构
XML主要由7个部分组成,
- 文档声明
- 标签/元素
- 属性
- 注释
- 实体字符
- CDATA 字符数据区。CDATA 指的是不应由 XML 解析器进行解析的文本数据（Unparsed Character Data）。CDATA 部分中的所有内容都会被解析器忽略。CDATA 部分由 `**` 结束，某些文本比如 JavaScript 代码，包含大量 “<” 或 “&” 字符。为了避免错误，可以将脚本代码定义为 CDATA。
- 处理指令,


一个标准的xml文件为
```xml
<!-- XML文档声明；同时也是一个处理指令,用于声明 XML 文档的版本和编码方式。<? xxx ?> 就是处理指令的格式-->
<?xml version="1.0" encoding="ISO-8859-1"?>
<!-- bookstore根元素、book子元素-->
<bookstore>
    <!-- category、lang都是属性-->
    <book category="COOKING">
        <title lang="en">Everyday Italian</title> 
        <!-- &lt;实体字符 是一个预定义的实体引用，这里也可以引用dtd中定义的实体，以 & 开头, 以;结尾-->
        <author>Giada De Laurentiis&lt;</author> 
        <year>2005</year> 
        <price>30.00</price>
        <!-- script这里是CDATA，不能被xml解析器解析，可以被JavaScript解析-->
        <script>
            <![CDATA[
   function matchwo(a,b)
   {
    if (a < b && a < 0) then
      {return 1;}
    else
      {return 0;}
   }
   ]]>
        </script>
    </book>
</bookstore>
```

#### DTD
DTD（Document Type Definition）是用来定义 XML 文档的结构和合法元素的集合。
DTD 定义了 XML 文档中可以出现的元素、属性和它们的顺序，以确保 XML 数据的格式和结构符合预定义的规则。
DTD 可以嵌入到 XML 文档中，也可以外部定义并引用。

DOCTYPE是DTD的声明
!ELEMENT> 声明用于定义 XML 文档中元素的结构和内容模型。它指定了元素的名称及其允许的子元素、文本内容或其他结构。
ENTITY是实体的声明，所谓实体可以理解为变量
SYSTEM、PUBLIC是外部资源的申请

从两个角度可以把XML分为两类共4个类型：

（内部实体、外部实体）

（通用实体、参数实体）

1)内部实体
所谓内部实体是指在一个实体中定义的另一个实体，也就是嵌套定义。
![](https://img.l1uyun.one/javasec-xxe注入_image_1.png)
![](https://img.l1uyun.one/javasec-xxe注入_image_2.png)
使用&xxe对上面定义的xxe实体进行了引用，到时候输出的时候&xxe就会被“test”替换。

在XML内部声明DTD:
```xml
<?xml version="1.0"?>
<!DOCTYPE note [
  <!ELEMENT note (to,from,heading,body)>
  <!ELEMENT to      (#PCDATA)>
  <!ELEMENT from    (#PCDATA)>
  <!ELEMENT message (#PCDATA)>
]>
<note>
    <to>George</to>
    <from>John</from>
    <message>Reminder</message>
</note>
```

2）外部实体
外部实体表示外部文件的内容，用 SYSTEM 关键词表示，通常使用下面的格式来引用
```xml
<!ENTITY entityName SYSTEM "fileName">
<!ENTITY example SYSTEM "/etc/passwd">


<!ENTITY entityName PUBLIC "publicID" "fileName">
<!ENTITY example PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "html4-transitional.dtd">
```
![](https://img.l1uyun.one/javasec-xxe注入_image_3.png)
有些XML文档包含system标识符定义的“实体”，这些文档会在DOCTYPE头部标签中呈现。这些定义的’实体’能够访问本地或者远程的内容。
假如 SYSTEM 后面的内容可以被攻击者控制，那么攻击者就可以随意替换为其他内容，从而读取服务器本地文件（file:///etc/passwd）或者远程文件（http://www.baidu.com/abc.txt）。

3）通用实体
用”&实体名“引用的实体，在DTD中定义，在XML文档中引用。
![](https://img.l1uyun.one/javasec-xxe注入_image_4.png)

4）参数实体
使用`% 实体名`（这里空格不能少）在 DTD 中定义，并且只能在 DTD 中使用`%实体名;`引用
只有在DTD文件中，参数实体的声明才能引用其他实体
和通用实体一样，参数实体也可以外部引用
![](https://img.l1uyun.one/javasec-xxe注入_image_5.png)

### XXE
XXE（XML External Entity Injection，XML 外部实体注入）是一种安全漏洞，通常发生在解析 XML 数据时。攻击者通过在 XML 文档中注入外部实体来读取本地文件、发送数据到远程服务器，甚至执行其他恶意操作。
XXE 攻击可能导致敏感信息泄露、服务拒绝（DoS）攻击等安全问题。

XXE漏洞之所以名为外部实体漏洞，就是因为问题主要出自于外部资源的申请以及外部实体的引用这部分特性中。我们从XXE的全称（XML外部实体注入）可以看出，XXE也是一种XML注入，只不过注入的是XML外部实体罢了。
![|500](https://img.l1uyun.one/javasec-xxe注入_image_6.png)
```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [  
  <!ELEMENT foo ANY >
  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]><foo>&xxe;</foo>
```
在这个示例中，`<!ENTITY xxe SYSTEM "file:///etc/passwd" > `定义了一个外部实体 xxe，指向本地文件 /etc/passwd。
当 XML 解析器解析这个 XML 数据时，它会尝试读取 /etc/passwd 文件的内容并将其插入到 <foo>&xxe;</foo> 标签中。

### Java 解析XML的四种方式 
1. DOM（Document Object Model）解析
   - DocumentBuilder: 用于解析 XML 数据并构建 DOM 文档对象模型。属于 JAXP（Java API for XML Processing）。
   - DOMParser: 一般指 DOM 解析器的实现（如 org.w3c.dom.DocumentBuilder）。它用于将 XML 数据解析成 DOM 文档结构。


2. SAX（Simple API for XML）解析
   - SAXParser: SAX 解析器，用于逐行读取 XML 数据，并触发相应的事件。属于 JAXP（Java API for XML Processing）。
   - Unmarshaller: JAXB 中的组件，用于将 XML 数据转换为 Java 对象。虽然它在 JAXB 中不直接属于 SAX，但它可以配置 SAX 解析器来处理 XML 数据。


3. JDOM 解析
   - SAXBuilder: JDOM 提供的一个类，用于通过 SAX 解析器构建 JDOM 文档对象模型。JDOM 是一个独立的 XML 处理库，与 DOM4J 和 JAXB 不同。


4. DOM4J（Document Object Model for Java）解析
   - SAXReader: DOM4J 提供的一个类，用于使用 SAX 解析 XML 数据。实际上，SAXReader 是 DOM4J 的一部分，而不是独立的 SAX 解析器。


## 复现平台
[Hello-Java-Sec](https://github.com/j3ers3/Hello-Java-Sec)
[JavaSec](https://github.com/bewhale/JavaSec)
## 漏洞分析
按照这两个平台提供的资源,来看看具体产生漏洞的代码.
### XMLReader
```java

/**
 * XMLReader 是一个接口，用于解析 XML 文档。它是 SAX (Simple API for XML) 的核心组件之一。
 * 它提供了对 XML 文档的逐行读取和解析功能，并将事件传递给相应的处理器。
 * 使用 XMLReader 时，需要注意安全问题，例如防止 XML 外部实体注入攻击。
 */
 
// payload: <?xml version="1.0" encoding="utf-8"?><!DOCTYPE test [<!ENTITY xxe SYSTEM "dsm6kqkg.dnslog.pw">]><root>&xxe;</root>

public String XMLReader(@RequestBody String content) {
    try {
        XMLReader xmlReader = XMLReaderFactory.createXMLReader();
        // 修复：禁用外部实体
        // xmlReader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        xmlReader.parse(new InputSource(new StringReader(content)));
        return "XMLReader XXE";
    } catch (Exception e) {
        return e.toString();
    }
}
```

![](https://img.l1uyun.one/javasec-xxe注入_image_2.png)
修复方法就是上面代码中的,setFeature,禁用外部实体
### SAXParser
```java
/**
 * javax.xml.parsers.SAXParser 是 XMLReader 的替代品，它提供了更多的安全措施，
 * 例如默认禁用 DTD 和外部实体的声明。如果需要使用 DTD 或外部实体，可以手动启用它们，
 * 并使用相应的安全措施。
 */
@ApiOperation(value = "vul：SAXParser")
@RequestMapping(value = "/SAXParser")
public String SAXParser(@RequestParam String content) {
	try {
		SAXParserFactory factory = SAXParserFactory.newInstance();
		SAXParser parser = factory.newSAXParser();
		parser.parse(new InputSource(new StringReader(content)), new DefaultHandler());
		return "SAXParser XXE";
	} catch (Exception e) {
		return e.toString();
	}
}
```
会有报错信息,但是dnslog弹成功了
![](https://img.l1uyun.one/javasec-xxe注入_image_7.png)
![](https://img.l1uyun.one/javasec-xxe注入_image_8.png)

### SAXReader
```java
/**
 * SAXReader 是一个用于读取和解析 XML 文档的类。它基于 SAX (Simple API for XML) 实现，
 * 提供了简单的 API 以便快速解析 XML。SAXReader 通常用于处理大规模 XML 数据流。
 * 在使用 SAXReader 时，需要采取相应的安全措施来防止 XML 外部实体注入等攻击。
 */

@ApiOperation(value = "vul：SAXReader")
@RequestMapping(value = "/SAXReader")
public String SAXReader(@RequestParam String content) {
	try {
		SAXReader sax = new SAXReader();
		// 修复：禁用外部实体
		// sax.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
		sax.read(new InputSource(new StringReader(content)));
		return "SAXReader XXE";
	} catch (Exception e) {
		return e.toString();
	}
}
```

### SAXBuilder

```java
/**
 * SAXBuilder 是一个用于构建 JDOM (Java Document Object Model) 文档的类。
 * 它基于 SAX 解析器，将 XML 数据解析为 JDOM 文档对象。SAXBuilder 提供了易于使用的 API，
 * 使得在内存中操作 XML 文档更加方便。在使用 SAXBuilder 时，应确保配置正确的安全设置，
 * 以防止潜在的 XML 处理漏洞。
 */

@RequestMapping(value = "/SAXBuilder")
public String SAXBuilder(@RequestBody String content) {
    try {
        SAXBuilder saxbuilder = new SAXBuilder();
        // 修复: saxbuilder.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        saxbuilder.build(new InputSource(new StringReader(content)));
        return "SAXBuilder XXE";
    } catch (Exception e) {
        return e.toString();
    }
}
```

### DocumentBuilder
```java
/**
 * DocumentBuilder 是用于构建和解析 XML 文档的类，它是基于 DOM (Document Object Model) 的实现。
 * DocumentBuilder 提供了创建、解析、修改 XML 文档的功能，并支持各种解析选项。在使用 DocumentBuilder 时，
 * 需要注意配置安全选项，例如禁用外部实体和 DTD，以防止潜在的安全漏洞。
 */
DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
// 修复: 禁用外部实体
// factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
DocumentBuilder builder = factory.newDocumentBuilder();
```

### Unmarshaller
```java
/**
 * Unmarshaller 是 JAXB (Java Architecture for XML Binding) 的核心组件之一，
 * 它将 XML 数据转换为 Java 对象。Unmarshaller 提供了将 XML 数据映射到相应 Java 类的功能，
 * 并支持各种自定义配置。在使用 Unmarshaller 时，需要注意处理 XML 数据中的外部实体和 DTD，
 * 以确保安全性。
 */

/**
  *  PoC
  * Content-Type: application/xml
  * <?xml version="1.0" encoding="UTF-8"?><!DOCTYPE student[<!ENTITY out SYSTEM "file:///etc/hosts">]><student><name>&out;</name></student>
  */
public String Unmarshaller(@RequestBody String content) {
    try {
        JAXBContext context = JAXBContext.newInstance(Student.class);
        Unmarshaller unmarshaller = context.createUnmarshaller();

        XMLInputFactory xif = XMLInputFactory.newFactory();
        // 修复: 禁用外部实体
        // xif.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        // xif.setProperty(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");

        XMLStreamReader xsr = xif.createXMLStreamReader(new StringReader(content));

        Object o = unmarshaller.unmarshal(xsr);
        return o.toString();

} catch (Exception e) {
    e.printStackTrace();
}
```

## 漏洞修复
一方面是禁用外部实体
```toml
"http://apache.org/xml/features/disallow-doctype-decl", true 
"http://apache.org/xml/features/nonvalidating/load-external-dtd", false
"http://xml.org/sax/features/external-general-entities", false
"http://xml.org/sax/features/external-parameter-entities", false

XMLConstants.ACCESS_EXTERNAL_DTD, ""
XMLConstants.ACCESS_EXTERNAL_STYLESHEET, ""
```
另一方面可以使用黑名单过滤掉外部实体中的关键词,这两个关键字是定义外部实体和文档类型声明的标志...不过貌似有上面的禁用就够了
```java
public static boolean checkXXE(String content) {
    String[] black_list = {"ENTITY", "DOCTYPE"};
    for (String s : black_list) {
        if (content.toUpperCase().contains(s)) {
            return true;
        }
    }
    return false;
}
```

## 漏洞发现

是否禁止dtd或者entity
参数是否可控
传入参数格式为REST XML格式，X-RequestEntity-ContentType: application/xml

黑盒找是否有参数是xml数据,如果有的话,直接上payload测测
白盒,搜索关键函数,进行代码审计
```
 * 审计的函数
 * 1. XMLReader
 * 2. SAXReader
 * 3. DocumentBuilder
 * 4. XMLStreamReader
 * 5. SAXBuilder
 * 6. SAXParser
 * 7. SAXSource
 * 8. TransformerFactory
 * 9. SAXTransformerFactory
 * 10. SchemaFactory
 * 11. Unmarshaller
 * 12. XPathExpression
```

# 一句话总结
在 Java 中，XXE（XML 外部实体注入）漏洞与其他语言类似：攻击者通过不安全的 XML 解析配置，在 XML 文档中注入恶意外部实体，能够读取本地文件、发起远程请求或执行其他恶意操作。
# 参考
小迪sec

[Java XXE漏洞原理研究](https://www.cnblogs.com/LittleHann/p/17776458.html)
