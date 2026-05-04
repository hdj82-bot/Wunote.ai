const HSK1: ReadonlySet<string> = new Set([
  '我','你','他','她','是','的','不','在','有','没','人','好','吗','呢','和','了','也','都','很','吃',
  '喝','看','听','说','学','习','中','国','汉','语','大','小','多','少','上','下','里','家','学校','老师',
  '学生','朋友','爸爸','妈妈','哥哥','姐姐','弟弟','妹妹','岁','今天','明天','昨天','现在','点','分','零','一','二','三',
  '四','五','六','七','八','九','十','百','块','钱','买','米','水','茶','菜','饭','车','出租车','飞机',
  '火','电','视','脑','话','北京','再见','谢谢','对不起','请','怎么','什么','哪儿','谁','喜欢','想','会','能','去','来'
])

const HSK2: ReadonlySet<string> = new Set([
  '帮','助','找','给','让','开始','觉得','可能','应该','希望','认识','知道','准备','介绍','参加','打篮球','踢足球','跑步','游泳','走',
  '跳舞','唱歌','跳','票','机场','火车站','宾馆','医院','银行','超市','教室','商店','餐厅','公司','洗','洗澡','刷','送','送给',
  '回','回家','回答','到','旁边','左边','右边','前面','后面','外面','上面','下面','中间','远','近','慢','快','贵','便宜','新',
  '旧','长','短','黑','白','红','蓝','绿','颜色','身体','头','眼睛','鼻子','耳朵','嘴','手','脚','身体好','感冒','发烧',
  '休息','锻炼','咖啡','牛奶','面包','鸡蛋','羊肉','牛肉','鱼','西瓜','苹果','报纸','杂志','铅笔','本子','椅子','桌子','门','窗户','空调'
])

const HSK3: ReadonlySet<string> = new Set([
  '其实','突然','最近','已经','一直','马上','一定','刚才','一边','只','才','就','再','还','又','或者','但是','虽然','因为','所以',
  '如果','为了','除了','关于','把','被','向','往','离','跟','着','过','完成','解决','发现','发生','放心','担心','害怕','变化',
  '比较','感兴趣','重要','简单','清楚','认真','聪明','努力','成绩','水平','文化','环境','机会','计划','节目','故事','经验','体育','音乐','艺术',
  '健康','安全','安静','干净','奇怪','害羞','满意','奇怪','着急','感动','感谢','放假','迟到','请假','参加','结束','安排','检查','打扫','搬',
  '搬家','搬运','护照','地图','地铁','船','邮局','超市','面条','蛋糕','果汁','啤酒','蔬菜','香蕉','葡萄','照片','照相机','空儿','节日','春天'
])

export const HSK_WORDLISTS = { 1: HSK1, 2: HSK2, 3: HSK3 } as const

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * 단어가 등재된 wordlist 의 최저 급수를 반환. 미등재 단어는 4 이상 (정확한 급수는 모름) 으로 추정.
 */
export function classifyWord(word: string): HskLevel {
  const w = word.trim()
  if (HSK1.has(w)) return 1
  if (HSK2.has(w)) return 2
  if (HSK3.has(w)) return 3
  return 4
}

/**
 * 문장에서 wordlist 매칭으로 추정한 HSK 급수의 최댓값을 반환한다.
 * Claude 응답의 hsk_level 검증용 폴백 — 일치하면 신뢰, 어긋나면 로그.
 *
 * 한자 1글자 이상 단어를 좌→우 그리디 longest-match 로 자른다 (3자 → 2자 → 1자 순).
 */
export function estimateMaxHskLevel(text: string): HskLevel {
  const chars = Array.from(text).filter(ch => /[一-鿿]/.test(ch))
  if (chars.length === 0) return 1
  let max: HskLevel = 1
  let i = 0
  while (i < chars.length) {
    let matched = false
    for (const len of [3, 2, 1]) {
      if (i + len > chars.length) continue
      const candidate = chars.slice(i, i + len).join('')
      const lvl = classifyWord(candidate)
      if (HSK1.has(candidate) || HSK2.has(candidate) || HSK3.has(candidate)) {
        if (lvl > max) max = lvl
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      max = Math.max(max, 4) as HskLevel
      i += 1
    }
  }
  return max
}

export interface HskValidationResult {
  agreesWithEstimate: boolean
  claudeLevel: number
  estimatedLevel: HskLevel
  /** 차이가 2 이상이면 의심스러움 */
  suspicious: boolean
}

export function validateClaudeHskLevel(claudeLevel: number, sourceText: string): HskValidationResult {
  const est = estimateMaxHskLevel(sourceText)
  const diff = Math.abs(claudeLevel - est)
  return {
    agreesWithEstimate: diff === 0,
    claudeLevel,
    estimatedLevel: est,
    suspicious: diff >= 2
  }
}
