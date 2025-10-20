---
title: javasec-sql注入
date: 2024-07-23T20:37:06
lastmod: 2025-09-29T20:53:12
tags:
  - sec
toc: "true"
---
# javasec-sql注入
## 前置知识
### sql注入
没有对用户的输入进行处理(过滤,黑名单,SQL预编译),直接将输入拼接到了sql语句中,

导致执行了用户构造的恶意SQL语句

SQL注入的语法与使用的数据库相关,与语言无关
### java数据库操作
#### jdbc
java database connection

java提供的数据库驱动库,用于进行数据库连接,执行SQL语句

JDBC有两个方法执行SQL语句，分别是PrepareStatement和Statement。

#### Hibernate
Hibernate是一个对象关系映射（ORM）框架，它将Java对象与数据库表进行映射，使开发者可以使用面向对象的编程方式来操作数据库。

Hibernate能够将Java类自动映射到数据库表上，并且能够自动生成SQL语句来操作数据库，减少了手动编写SQL的繁琐工作。
#### Mybatis
Mybatis是一个持久层框架，它通过消除几乎所有的JDBC代码和手动设置参数及获取结果集的工作来简化对数据库的操作。Mybatis可以通过XML或注解的方式将要执行的SQL、参数和结果映射进行配置。

Mybatis与Hibernate这样的ORM（对象关系映射）框架不同，它更关注SQL本身，适合对数据库操作有较高控制要求的场景。其高效、灵活和简洁的特性，使得它在企业级开发中被广泛使用。

## 复现环境
[Hello-Java-Sec](https://github.com/j3ers3/Hello-Java-Sec)
![](https://img.l1uyun.one/javasec-sql注入_image_1.png)
[JavaSec](https://github.com/bewhale/JavaSec)
![](https://img.l1uyun.one/javasec-sql注入_image_2.png)
## JDBC
JDBC有两个方法执行SQL语句，分别是PrepareStatement和Statement。

JDBCTemplate是Spring对JDBC的封装
### Statement
这就是普通的写法,没有使用预编译
```java
// 采用Statement方法拼接SQL语句，导致注入产生

public String vul1(String id) {
    Class.forName("com.mysql.cj.jdbc.Driver");
    Connection conn = DriverManager.getConnection(db_url, db_user, db_pass);

    Statement stmt = conn.createStatement();
    // 拼接语句产生SQL注入
    String sql = "select * from users where id = '" + id + "'";
    ResultSet rs = stmt.executeQuery(sql);
    ...
}
```
报错注入的语法
```bash
http://127.0.0.1:8888/SQLI/JDBC/vul1?id=1%27%20and%20updatexml(1,concat(0x7e,(SELECT%20user()),0x7e),1)--%20+
```
![](https://img.l1uyun.one/javasec-sql注入_image_3.png)

### PrepareStatement
这里是使用了预编译,但是没有按照预编译的语法来写,还是有漏洞存在
```java
// PrepareStatement会对SQL语句进行预编译，但如果直接采取拼接的方式构造SQL，此时进行预编译也无用。

public String vul2(String id) {
    Class.forName("com.mysql.cj.jdbc.Driver");
    Connection conn = DriverManager.getConnection(db_url, db_user, db_pass);
    String sql = "select * from users where id = " + id;
    PreparedStatement st = conn.prepareStatement(sql);
    ResultSet rs = st.executeQuery();
}
```
![](https://img.l1uyun.one/javasec-sql注入_image_4.png)
### JDBCTemplate
也是一样的,如果使用拼接,而不是使用占位符,就会导致SQL注入
```java
// JDBCTemplate是Spring对JDBC的封装，如果使用拼接语句便会产生注入

public Map<String, Object> vul3(String id) {
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    ...
    JdbcTemplate jdbctemplate = new JdbcTemplate(dataSource);

    String sql_vul = "select * from users where id = " + id;
    // 安全语句
    // String sql_safe = "select * from users where id = ?";

    return jdbctemplate.queryForMap(sql_vul);
}
```


### 黑名单过滤
修复方法是采用黑名单过滤掉危险字符,当然,最好还是使用预编译的方法
```java
// 采用黑名单过滤危险字符，同时也容易误伤（次方案）

public static boolean checkSql(String content) {
    String[] black_list = {"'", ";", "--", "+", ",", "%", "=", ">", "*", "(", ")", "and", "or", "exec", "insert", "select", "delete", "update", "count", "drop", "chr", "mid", "master", "truncate", "char", "declare"};
    for (String s : black_list) {
        if (content.toLowerCase().contains(s)) {
            return true;
        }
    }
    return false;
}
```
### 使用?占位符
解决方法就是采用预编译的正确写法,占位符
```java
// 正确的使用PrepareStatement可以有效避免SQL注入，使用？作为占位符，进行参数化查询

public String safe1(String id) {
    String sql = "select * from users where id = ?";
    PreparedStatement st = conn.prepareStatement(sql);
    st.setString(1, id);
    ResultSet rs = st.executeQuery();
}
```

### 使用ESAPI过滤输入
安全写法是使用ESAPI来对输入进行过滤,当然使用占位符就可以了
```java
// ESAPI 是一个免费、开源的、网页应用程序安全控件库，它使程序员能够更容易写出更低风险的程序
// 官网：https://owasp.org/www-project-enterprise-security-api/

public String safe3(String id) {
    Codec<Character> oracleCodec = new OracleCodec();

    Statement stmt = conn.createStatement();
    String sql = "select * from users where id = '" + ESAPI.encoder().encodeForSQL(oracleCodec, id) + "'";

    ResultSet rs = stmt.executeQuery(sql);
}
                    
```
### 强制参数类型
不使用string类型的参数,而是写死类型,那样也能避免sql注入
```java
// 如果参数类型为boolean,byte,short,int,long,float,double等，sql语句无法拼接字符串，因此不存在注入

public Map<String, Object> safe4(Integer id) {
    String sql = "select * from users where id = " + id;
    return jdbctemplate.queryForMap(sql);
}
```

### 总结
-jdbc
出现SQL注入的条件是

1、采用Statement方法拼接SQL语句

2、PrepareStatement会对SQL语句进行预编译，但如果直接采取拼接的方式构造SQL，此时进行预编译也无用。

3、JDBCTemplate是Spring对JDBC的封装，如果使用拼接语句便会产生注入

安全写法：SQL语句占位符（?） + PrepareStatement预编译

## Mybatis
MyBatis框架底层已经实现了对SQL注入的防御，但存在使用不当的情况下，仍然存在SQL注入的风险。

MyBatis支持两种参数符号，一种是#，另一种是$，#使用预编译，\$使用拼接SQL。

这里的问题主要是使用#{}的问题,使用#{}之后,传进来的参数会被转成带双引号的字符串,导致sql语句错误,开发偷懒就使用了${}进行拼接处理.
### order by 注入
```java
// 由于使用#{}会将对象转成字符串，形成order by "user" desc造成错误，因此很多研发会采用${}来解决，从而造成SQL注入

@GetMapping("/vul/order")
public List<User> orderBy(String field, String sort) {
    return userMapper.orderBy(field, sort);
}

// xml方式
<select id="orderBy" resultType="com.best.hello.entity.User">
    select * from users order by ${field} ${sort}
</select>

// 注解方式
@Select("select * from users order by ${field} desc")
List<User> orderBy2(@Param("field") String field);
                    
```

```bash
http://127.0.0.1:8888/SQLI/MyBatis/vul/order?field=id&sort=desc,1

[{"id":2,"user":"admin","pass":"password"},{"id":1,"user":"zhangwei","pass":"123456"}]
```

### 搜索框注入

```bash
// 模糊搜索时，直接使用'%#{q}%' 会报错，部分研发图方便直接改成'%${q}%'从而造成注入

@Select("select * from users where user like '%${q}%'")
List<User> search(String q);

// 安全代码,采用concat
@Select("select * from users where user like concat('%',#{q},'%')")
List<User> search(String q);
```

### in 注入
这里也是使用了${}来进行了拼接,会导致错误
```bash
    @RequestMapping("/in")
    public String in(String ids, Model model) {
        try {
//            List<String> list = Arrays.asList(ids.split(","));
//            ArrayList<Admin> adminList = injectService.in(list);
            ArrayList<Admin> adminList = injectService.in(ids);
            model.addAttribute("userInfo", adminList);
        } catch (Exception e) {
            e.printStackTrace();
            model.addAttribute("results", e.toString());
        }
        return "basevul/sqli/mybatis_in";
    }


    //  正确安全写法
    //  @Select("<script>" + "SELECT * FROM users WHERE id IN " + "<foreach item='item' index='index' collection='ids' open='(' separator=',' close=')'>" + "#{item}" + "</foreach>" + "</script>")
    //  ArrayList<Admin> in(@Param("ids") List<String> ids);
    @Select("Select * from users where id in (${ids})")
    ArrayList<Admin> in(@Param("ids") String ids);
}
```
### 使用排序映射
安全写法是在xml中使用排序映射
```xml
<select id="orderBySafe" resultType="com.best.hello.entity.User">
    select * from users
    <choose>
        <when test="field == 'id'">
            order by id desc
        </when>
        <when test="field == 'user'">
            order by user desc
        </when>
        <otherwise>
            order by id desc
        </otherwise>
    </choose>
</select>
```
### 使用#{}
 使用Mybatis作为持久层框架，应通过#{}语法进行参数绑定，MyBatis 会创建 PreparedStatement 参数占位符，并通过占位符安全地设置参数。
```java
// 使用 #{} 安全编码
@Select("select * from users where user like CONCAT('%', #{user}, '%')")
List<User> queryByUser(@Param("user") String user);
```
### 强制参数类型
安全写法,强制类型
```java
// 使用 ${} 本身是存在注入的，但由于强制使用Integer或long类型导致注入无效（无法注入字符串）

@Select("select * from users where id = ${id}")
List<User> queryById2(@Param("id") Integer id);
```

### 总结
-MyBatis
MyBatis支持两种参数符号，一种是#，另一种是$，#使用预编译，\$使用拼接SQL。

1、order by注入：由于使用#{}会将对象转成字符串，形成order by "user" desc造成错误，因此很多研发会采用${}来解决，从而造成注入.

2、like 注入：模糊搜索时，直接使用'%#{q}%' 会报错，部分研发图方便直接改成'%${q}%'从而造成注入.

3、in注入：in之后多个id查询时使用 # 同样会报错，从而造成注入.

# 一句话总结
在写sql语句时使用预编译,并且正确使用占位符,不要直接进行拼接处理

# 引用
小迪sec 