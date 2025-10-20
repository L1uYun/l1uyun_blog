document.addEventListener('DOMContentLoaded', async () => {
  const searchButton = document.querySelector('#searchBoxButton')
  const searchInput = document.querySelector('#searchBoxInput')
  const searchResult = document.querySelector('#searchResult')
  const searchCount = document.querySelector('#searchCount')

  function parseLocationSearch() {
    let locationSearch = location.search
    let result = {}
    if (locationSearch == '') {
      return result
    }
    locationSearch = locationSearch.substr(1)
    for (let kv of locationSearch.split('&')) {
      if (kv == '') {
        continue
      }
      const [k, v] = kv.split('=')
      result[k] = decodeURIComponent(v)
    }
    return result
  }

  // 判断是否包含中日韩文字
  function containsCJK(str){
    return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(str)
  }

  var fuseOptions = {
    shouldSort: true,
    includeMatches: true,
    findAllMatches: true,
    threshold: 0.3,
    tokenize: false,
    ignoreLocation: true,
    location: 0,
    distance: 2000,
    maxPatternLength: 128,
    minMatchCharLength: 1,
    keys: [
      { name: "title",   weight: 0.8 },
      { name: "summary", weight: 0.5 },
      { name: "tags",    weight: 0.3 },
      { name: "date",    weight: 0.2 },
      { name: "content", weight: 1.0 } // 需要 index.json 提供 content 字段
    ]
  };

  let fuse = null
  let indexCache = null

  async function getFuse() {
    if (fuse == null) {
      const resp = await fetch('/index.json', { method: 'get' })
      indexCache = await resp.json()
      fuse = new Fuse(indexCache, fuseOptions)
    }
    return fuse
  }

  function render(items) {
    return items.map(item => {
      item = item.item || item // 兼容手动匹配的对象
      return `<div class="post on-list">
                <h1 class="post-title"><a href="${item.permalink}">${item.title}</a></h1>
                <div class="post-meta"><span class="post-date">${item.date}</span> <span>#${item.tags}</span></div>
                <div class="post-content">${item.summary}</div>
              </div>`}).join('')
  }

  function updateDOM(html, number) {
    searchResult.innerHTML = html
    searchCount.innerHTML = `共查询到 ${number} 篇文章`
  }

  function plainIncludesMatch(haystack, needle){
    if(!haystack) return false
    return String(haystack).toLowerCase().includes(String(needle).toLowerCase())
  }

  function manualCJKSearch(q){
    if(!indexCache) return []
    const res = []
    for(const it of indexCache){
      if (plainIncludesMatch(it.title, q) || plainIncludesMatch(it.summary, q) || plainIncludesMatch(it.content, q) || (Array.isArray(it.tags) && plainIncludesMatch(it.tags.join(','), q))){
        res.push(it)
      }
    }
    // 统一成与 Fuse 相同的结构或直接返回对象数组，由 render 兼容
    return res
  }

  async function search() {
    const searchString = searchInput.value.trim()
    if(!searchString){ updateDOM('', 0); return }
    const fuse = await getFuse()
    let result = fuse.search(searchString)
    // CJK 关键字下，Fuse 命中可能较差，增加手动包含匹配兜底
    if (containsCJK(searchString)){
      const manual = manualCJKSearch(searchString)
      // 若 Fuse 结果过少，则以手动匹配结果为准；否则合并去重
      if (result.length < manual.length){
        result = manual // render 会兼容对象数组
      } else if (manual.length){
        const permalinks = new Set(result.map(r => (r.item&&r.item.permalink)||r.permalink))
        for(const it of manual){
          const link = it.permalink
          if(!permalinks.has(link)) result.push(it)
        }
      }
    }
    const html = render(result)
    updateDOM(html, Array.isArray(result)? result.length : result.length)
  }

  function doSearch() {
    const wd = parseLocationSearch()['q'] || ''
    searchInput.value = wd
    if (wd) {
      search()
    } else {
      updateDOM('', 0)
    }
  }

  function goSearch() {
    searchCount.innerHTML = `查询中…`
    if (searchInput.value == parseLocationSearch()['q']) {
      return
    }
    history.pushState('', '', location.pathname + '?q=' + encodeURIComponent(searchInput.value))
    searchInput.blur();
    doSearch()
  }

  searchButton.addEventListener('click', goSearch)
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      goSearch()
    }
  })

  doSearch()

  window.addEventListener('popstate', doSearch)

})