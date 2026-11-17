function writingStamp(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return `${text.length}.${value >>> 0}`;
}

function clipManuscript(text, head, tail) {
  return text.length <= head + tail ? text : `${text.slice(0, head)}\n〔中段省略〕\n${text.slice(-tail)}`;
}

function writingInput(project, chapter, direction) {
  let context;
  try { context = contextFor(project, chapter); }
  catch (error) {
    if (error.code !== 'CYCLIC_BRANCHES') throw error;
    context = contextFor(project);
    context.branchContext = '本作包含循环，来路可能不同。只把当前章原文和作者的事实记录作为已经发生的事情。';
  }
  const trim = (value, limit) => String(value || '').slice(0, limit);
  const cards = items => items.slice(0, 8).map(item => Object.fromEntries(
    Object.entries(item).filter(([key, value]) => key !== 'id' && typeof value === 'string').map(([key, value]) => [key, trim(value, 350)])
  ));
  const sources = retrieve(project, [chapter.text.slice(-1600), chapter.outline, project.idea, project.constraints].join(' '), 3);
  return {
    mode: chapter.text.trim() ? '续写正文' : '写故事开头', direction,
    idea: clipManuscript(project.idea, 2000, 1200),
    chapter: {title: chapter.title, outline: trim(chapter.outline, 1700), memory: trim(chapter.memory, 1200)},
    title: project.title, type: project.type, styles: project.styles, tags: project.tags, pov: project.pov, tone: project.tone,
    world: trim(project.world, 1500), constraints: trim(project.constraints, 1500),
    plan: trim(project.plan, 1500), characters: cards(context.characters), scenes: cards(context.scenes),
    commonPast: context.pathFacts.slice(-4).map(c => ({title: c.title, facts: trim(c.memory, 650)})),
    previousTail: context.previousTail.slice(-1400), branchGuidance: context.branchContext,
    exits: context.outline[project.chapters.indexOf(chapter)]?.choices.map(({label, condition, effect}) => ({label, condition, effect})) || [],
    ...(context.clueGuidance ? {clueGuidance: context.clueGuidance} : {}),
    sources: sources.map(({title, excerpt}) => ({title, excerpt: trim(excerpt, 450)})),
    manuscript: clipManuscript(chapter.text, 1400, 6800)
  };
}

function protagonist(input, text) {
  const narrative = text.replace(/[“「『"][^”」』"\n]*[”」』"]/gu, '');
  if (/(?:^|[，。！？：、\s])我(?!们)|我(?:把|将|伸|听|看|走|问|摸|的|没|在|却|才|和|正|得|能|只|还|不)/u.test(narrative)) return '我';
  if (/(?:^|[，。！？：、\s])你(?:把|将|伸|听|看|走|问|摸|的|没|在|却|才|正|得|能|只|还|不)/u.test(narrative)) return '你';
  const known = input.characters.filter(c => c.name && narrative.includes(c.name)).sort((a,b) => narrative.lastIndexOf(b.name) - narrative.lastIndexOf(a.name));
  if (known.length) return known[0].name;
  const surnames = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏苏潘葛范彭郎鲁韦马苗方俞任袁柳唐费薛雷贺倪汤殷罗郝安傅常顾孟黄萧尹姚邵汪毛宋熊舒屈项董梁杜阮席季贾江郭林钟徐邱高夏蔡田胡霍黎叶余陆白程肖丁莫梅温齐岳池蔺裴闻段桑辛穆路蓝纪石岑洛';
  const avoid = /^(?:钟声|钟表|钟面|钟楼|白天|白纸|白布|石头|石阶|石门|门口|雷声|风声|马车|江边|江水|陆地|雨水|余下|温度|金属|林子|林间|树林|叶子|黄灯|陈列|沈默|方才|方向|常常|高处|高台|段落|周围|最后|蓝色|宋体|桌上|手上|声响|桥上)$/u;
  const names = [...narrative.matchAll(new RegExp(`(?:欧阳|司马|上官|诸葛|[${surnames}])[\\p{Script=Han}]{1,2}?(?=(?:忽然|终于|轻轻|慢慢|小心|悄悄|第一次|只好|正要|刚刚|已经|没有|正在|一把|把|将|在|是|来到|走|赶|站|推|守|听|看|问|说|伸|摸|从|抬|接|拆|打开|发现|转|递|按|坐|醒|捡|找到|拿|收|捏|写|翻|登|捧|试|跟|盯|拉|掀|攥|敲|皱|认|烧|烤|修|追|收到|决定|必须|想要|要在|要把|带着|听见|盼|等|发觉|拨|系|，|。|：))`, 'gu'))].map(m => m[0]).filter(n => !avoid.test(n) && !/[的在把着是了]/u.test(n));
  if (names.length) return names.at(-1);
  const nickname = narrative.match(/(?:阿[\p{Script=Han}]|小[满禾棠雨梨雪兰夏晴川安宁北洛六九七云星秋春冬梅岚鹿桃石竹])(?=把|在|将|走|站|问|说|拿|握|看|听|从|捧|来到|发现|打开|抬|推|翻|伸|蹲|捏|，|。)/gu);
  if (nickname?.length) return nickname.at(-1);
  const roles = narrative.match(/钟表匠|修钟人|守塔人|守夜人|面包师|糕点师|邮递员|邮差|宇航员|航天员|潜水员|修理工|调音师|园丁|厨师|船长|水手|医生|护士|老师|学生|女孩|男孩|少年|姑娘|外婆|奶奶|母亲|父亲|机器人|小狐狸|小兔子/gu);
  if (roles?.length) return roles[0];
  const pronouns = narrative.match(/[她他它](?!们)/gu);
  if (pronouns?.length) return pronouns.at(-1);
  if (input.characters[0]?.name) return input.characters[0].name;
  if (input.pov?.includes('第一人称')) return '我';
  if (input.pov?.includes('第二人称')) return '你';
  return '那人';
}

function storyFrames() {
  return [
    {words:'信封 信纸 邮戳 邮票 邮筒 信箱 信件 回信 明信片 收件人 邮局 邮差 门牌 收信 封信 寄来 寄信 寄出 退信 退件', object:'信封 信纸 邮票 明信片 信件 邮戳 回信', defaultObject:'信封', focus:'地址', beats:[
      '{人}把{物}斜向亮处。墨水下面还有一道笔痕，写到门牌号的最后一笔时，笔尖把纸划破了。',
      '“按头一个地址投，还是按改过的投？”柜台里的人问。{人}取回邮资，在背面写下自己的地址。“送不到，就退给我。”',
      '退件栏本来空着。{人}刚要填上日期，才看见底下垫着薄薄一层复写纸。上一行压出来的是今天，字迹却是小时候的。',
      '门内的人只把信取走一半，留着一角给{人}捏着。隔了许久，那只手松开，把一张写满字的收条从门缝里推出来。'
    ]},
    {words:'面包 面团 酵母 酵种 烤炉 烤箱 吐司 面粉 发酵 饼干 糕点 馒头 烘焙 揉面',object:'面包 面团 酵种 酵母 吐司 面粉 饼干 馒头 糕点',defaultObject:'面团',focus:'炉温',beats:[
      '{人}在案板上撒了两道面粉，一道留着比照，一道用手指轻轻推开。风从本该封死的炉底钻进来，把第二道吹成了缺口。',
      '“先别卖。”{人}把头一炉掰开，脆皮在两人之间响了一声。等在门口的人掏钱的手停住了，伸出一根指头，指着里面那块没发起来的面。',
      '{人}关掉炉火，把{物}留下了一小份。刚合上盖，盖沿便顶起一条细缝。隔壁案板上，同样一只空盒也跟着轻轻跳了一下。',
      '最后一只烤盘刚好装得下两份。{人}空出一半，递过刮板。那双总在门外等着的手终于伸过来，在面粉里留下四个清楚的指印。'
    ]},
    {words:'信号 无线电 呼号 频率 通讯 通信 电台 电波 天线 宇航员 船舱 求救信号 求救声 失联 舱门 舱壁 太空 飞船 轨道 星舰 卫星 空间站 气闸 探测器',object:'电台 天线 话筒 接收器 耳机 呼叫器 探测器 舱门 终端',defaultObject:'接收器',focus:'回声',beats:[
      '{人}在两声短响中间敲了一下，随即松手。下一轮，空白处多出相同的一拍。等到第三轮，那一拍先响了。',
      '“收到的话，把最后一个数减一。”{人}等着。回答隔了很久才传来。报出的数字又小了一位，后面还有一道声音在数。',
      '{人}断开电源，噪声停了。那组短响还在，沿着金属一格一格移近。等{人}把手贴上去，另一边也贴上来什么，不再敲了。',
      '记录只剩最后一行。{人}没有填上约定的结束语，留了三个等长的空格。另一端先填满两个，停了一会儿，把最后一个还了回来。'
    ]},
    {words:'灯塔 海港 渔船 潮水 潮汐 退潮 涨潮 浮标 船锚 航道 海雾 海岛 码头 轮渡 海面 船长 海底 航海 船桨',object:'灯塔 浮标 船锚 船桨 船灯 渔船 罗盘 航标',defaultObject:'浮标',focus:'水线',beats:[
      '{人}在石阶边刻下一道水痕。浪退了三次，每次都刚好露出那道刻痕。只有靠岸的那一小片水，反而越积越高。',
      '“你数的是浪，还是浪中间的空当？”{人}重新数了一遍。在第三个空当里，有人用船桨轻轻叩了两声。离岸很近。',
      '水线退到旧系缆桩下，露出一截绳头。{人}伸手去拾，绳上却传来一个活结收紧的力道。雾里有人先一步攥住了另一头。',
      '{人}把那截绳在手腕上绕了一圈，又解下来，系到石桩上。对面试着扯了两下。直到第二下落稳，岸上的人才敢松手。'
    ]},
    {words:'钟表 怀表 挂钟 闹钟 钟楼 钟声 时针 分针 秒针 指针 表盘 齿轮 钟匠 修钟 修表 表匠 钟面 停摆',object:'怀表 挂钟 闹钟 秒针 时针 分针 表盘 钟面 齿轮',defaultObject:'钟面',focus:'刻度',beats:[
      '{人}让{物}留在原处，用指节轻敲桌沿。第一声和滴答挨在一起，第二声已经错开半拍。慢的竟是自己的手。',
      '“它上次准时是什么时候？”{人}问。对面的人张开嘴，先看了一眼空着的手腕，才说：“就是我把它交给你的那天。”',
      '下一声报时迟迟没来。{人}俯身去听，听见停住的那一格里，齿轮还在独自走动。一张折得极窄的纸从背板下慢慢探出头来。',
      '{人}用铅笔把两个时刻都记下，故意空出中间一行。过了一阵，那行纸轻轻鼓起来，纸背有支笔正一笔一画地写。'
    ]},
    {words:'琴弦 钢琴 小提琴 大提琴 乐谱 琴谱 音符 演奏 排练 调音师 节拍 合唱 琴键 笛子 乐器 歌声 八音盒',object:'琴弦 琴键 乐谱 琴谱 笛子 八音盒 节拍器',defaultObject:'乐谱',focus:'休止符',beats:[
      '{人}把那小节又数了一遍，到该响的地方偏偏空着。等余音落尽，墙的另一面把空下的一拍送了回来。',
      '“这里原来有个换气的地方。”{人}停下手。旁边的人先是摇头，随后很轻地吸了一口气，恰好赶在下一拍之前。',
      '{人}故意早进了一拍。跟着的声音没有乱，仍按原来的速度往前走。直到这一刻，两条原本叠在一起的旋律才听得分明。',
      '最后一小节空着。{人}先写下一枚休止符，把笔顺着桌面推过去。等了半晌，另一只手才添上第一个音。'
    ]},
    {words:'种子 种籽 花盆 树苗 苗圃 发芽 温室 根须 幼苗 种植 种花 园丁 栽树 果树 花园 菜园',object:'种子 种籽 树苗 花盆 幼苗 果核 花籽',defaultObject:'种子',focus:'土痕',beats:[
      '{人}只浇了半边的土，另半边仍是干的。没过一会儿，一线深色却从干土里先洇出来，弯弯曲曲地，直通墙根。',
      '“埋多深？”{人}问。对方用手指比了一截，又收回去。“浅一点。万一它想回来，还能找着路。”',
      '{人}蹲下来把浮土慢慢拨开。那条看着像根的细线从土里伸出来，末梢竟打着一个活结。地底下有谁轻轻扯了一下。',
      '旧标签翻过来，还有一面能写。{人}把日期留在自己这边，将名字那一面空给明天，再把标签牢牢压进湿土。'
    ]},
    {words:'车票 车厢 站台 月台 火车 列车 地铁 铁轨 末班车 车站 检票 候车 乘客',object:'车票 票根 站牌 时刻表 车门',defaultObject:'车票',focus:'站名',beats:[
      '{人}把鞋尖移到白线后面。广播报到第三遍，吞掉的仍是同一个站名。月台边却有人起身，像是偏偏听懂了那段空白。',
      '“这趟还停吗？”{人}问。检票的人没抬头，把掌心里的小圆孔递过来。“票打过了，你看孔的位置。”',
      '车轮声从轨道远处传来，眼前的玻璃却先映出一节亮着灯的车厢。{人}往旁边让了一步，倒影里的那个位置还是满的。',
      '发车铃响到一半，{人}折回长椅，把给另一个人留的地方擦干净。铃停了。身边的椅面轻轻向下沉了一点。'
    ]},
    {words:'账本 名册 档案 登记 编号 失物 柜台 存根 签收 名簿 账簿 名单 收据 卷宗',object:'账本 名册 档案 存根 名簿 收据 登记簿 名单 卷宗',defaultObject:'登记簿',focus:'空栏',beats:[
      '{人}把{物}挪到亮处。那一栏擦得太干净，旁边的格线上反而留着半个字。笔画朝着空格外头，像是写字的人中途换过手。',
      '“这笔是谁签的？”{人}用指腹压住日期。对面的人只看了笔画的走向，便把原本伸出来的右手藏到了背后。',
      '下一行还没人填。{人}从背面摸到一道凸痕，翻过纸来，沿着凸起描了一遍。那是一个刚刚才听见的名字。',
      '{人}另起一行，把看见的和猜到的分开记。轮到签名时，对面的手第一次没往后缩，慢慢在旁边添了一笔。'
    ]}
  ];
}

function wordHits(text, list) {
  return list.split(' ').map(word => ({word, at: text.lastIndexOf(word)})).filter(hit => hit.at >= 0);
}

function mentionedObject(text) {
  const found = [...text.matchAll(/(?:这|那|一)(?:件|只|枚|盏|把|张|串|盒|条|面|块|柄|支|扇|册|本|根|颗|顶|座|匹|扇|双|团)([\p{Script=Han}]{1,14})/gu)];
  for (const match of found.reverse()) {
    const phrase = match[1].split(/忽然|突然|正要|竟然|缓缓|轻轻|一动|里面|上面|底下|旁边|开始|躺在|出现|发出|落在|递给|装着|藏着|打开|贴在|滑进|滚到|停在|伸出|已经|不会|不见|还在|却|正|把|被|从|往|塞|拿|递|扔|放|掉|向|又|竟|就|会|在|已|和|与|朝|时|仍|也/u)[0].replace(/(?:了|着|的|里|上|下)$/u,'');
    if (phrase.length >= 1 && phrase.length <= 8 && !/^[他她它我你这那第]/u.test(phrase)) return phrase;
  }
  const after = text.match(/(?:捡起|握紧|攥紧|握着|捏着|拿着|举起|拾起|递过|递来|递给我|翻开|戴上|推开|抽出|藏起)([\p{Script=Han}]{2,7})(?=[。，！？、“”\s]|$)/u);
  return after?.[1]?.replace(/^(?:那|这)/u, '') || '';
}

function offlineDraft(input, variant = 0) {
  const source = input.manuscript.trim() || input.idea.trim() || input.chapter.outline || input.previousTail || input.commonPast.at(-1)?.facts || input.world || [...input.characters, ...input.scenes].map(x => x.name).join('，');
  const tail = source.slice(-500);
  const basis = [input.idea, input.chapter.outline, input.previousTail, input.world, ...input.characters.map(c => c.role || ''), ...input.scenes.map(s => s.name || '')].filter(Boolean).join(' ');
  const ranked = [...storyFrames(),familyDrafts()].map(frame => {
    const hits = wordHits(tail, frame.words);
    const score = hits.reduce((sum, h) => sum + 8 + (h.at > tail.length - 85 ? 3 : 0), 0) + Math.min(6, wordHits(basis,frame.words).length * 2);
    return {frame, score};
  }).sort((a,b) => b.score-a.score);
  const frame = ranked[0].score ? ranked[0].frame : null;
  const person = protagonist(input, source.slice(0, 200) + '。' + tail);
  const objectHits = frame ? wordHits(tail, frame.object).sort((a,b) => b.at-a.at) : [];
  const item = objectHits[0]?.word || mentionedObject(tail) || frame?.defaultObject || '';
  const places = [...tail.matchAll(/灯塔|邮局|烘焙坊|面包房|面包店|厨房|琴房|剧院|温室|医务室|厨房|图书馆|驾驶舱|控制室|指挥室|空间站|船舱|码头|车站|月台|教室|医院|裁缝铺|公寓|阁楼|村口|茶馆|森林|山谷|天台|桥头|城门|山洞|雪原|沙漠|冰原|花园/gu)];
  const place = places.at(-1)?.[0] || input.scenes.find(x => x.name && source.includes(x.name))?.name || input.scenes[0]?.name || '';
  const detail = tail.split(/[，。；！？\n“”「」『』]/u).map(x => x.trim()).filter(x => x.length >= 2).at(-1) || tail.trim();
  const subject = item || (place ? `${place}里的动静` : '这件事');
  const quote = detail.length > 22 ? detail.slice(-22) : detail;
  const generic = [
    `{人}把注意力又放回${subject}上。方才所有人都在等一个答复，只有角落里的那位，在事情发生前就往旁边让了半步。`,
    `“你什么时候知道的？”{人}问。对方起先说是刚才，说到一半又改口：“在你提起${item || place || '这件事'}以前。”那半句改掉的话，谁都听清了。`,
    `有人试着复述刚才的经过，说到“${quote}”却卡住了。{人}请旁人再讲一次。两个人漏掉的恰好是同一处，目光却投向截然相反的方向。`,
    `{人}没有催促，先把自己能做的那一步做了。一直等着看结果的人退开一点，让出位置。留下来的那位开了口，声音比方才低：“还来得及，跟我走。”`
  ];
  const beats = frame?.beats || generic;
  const fill = line => line.replaceAll('{人}',person).replaceAll('{物}',item || frame?.defaultObject || '那件东西');
  const start = {'顺势推进':0,'用对话推进':1,'加入转折':2}[input.direction] ?? 0;
  const order = [0,1,2,3].map((_,i) => (start + variant + i) % beats.length);
  const fresh = order.filter(i => !input.manuscript.includes(fill(beats[i])));
  const specific = groundedBeat(input, tail, person, item, place, frame);
  const grounded = specific && !input.manuscript.includes(specific);
  const first = fresh[0] ?? order[0];
  const second = fresh.find(i => i !== first && (i !== 2 || first !== 0)) ?? fresh.find(i => i !== first);
  const paragraphs = [];
  if (grounded) paragraphs.push(specific);
  else if (!input.manuscript.trim() && place) paragraphs.push(`${place}。最先察觉异样的是${person === '那人' ? '那个一直没作声的人' : person}。`);
  if (!fresh.length) {
    // Once these beats have been used, stay with the writer's last new words instead of replaying the scene.
    const other = generic.map(fill).filter(line => !input.manuscript.includes(line));
    if (other.length) return [other[variant % other.length], other[(variant + 1) % other.length]].filter((line,i,a) => a.indexOf(line) === i).join('\n\n');
    throw Error('这一段的离线规则已经用尽。可写入一个新动作，或选择本机模型继续发展情节。');
  }
  paragraphs.push(fill(beats[first]));
  if (!grounded && second !== undefined) paragraphs.push(fill(beats[second]));
  return paragraphs.join('\n\n');
}

function groundedBeat(input, source, person, item, place, frame) {
  const tail = source.slice(-800);
  const says = [...tail.matchAll(/[“「『"]([^”」』"\n]{2,75})[”」』"]/gu)].at(-1)?.[1];
  const postal = frame?.focus === '地址';
  if (postal && /明[天日]|未来|[十百两三五\d]+年后|下周|下星期/u.test(tail)) {
    const date = tail.match(/明天|明日|未来|[十百两三五\d]+年后|下周[一二三四五六日]?|下星期[一二三四五六日]?/u)[0];
    return `${person}先去翻戳记盒。标着${date}的那一格还封在纸套里，纸边连一点折痕也没有。再对照${item || '信封'}上的印子，缺的偏偏是旧戳才有的那一角。`;
  }
  if (postal && /搬走|搬离|迁走|迁出|查无此人|无人签收|已经去世|早已去世/u.test(tail)) {
    return `${person}顺着旧门牌往下摸，摸出两个钉孔。新住户从门里递出一只饼干盒，里面每封退信都朝向同一面，等着谁来把它们一起带走。`;
  }
  if (/回到|送回|原封不动|回来了|重又出现|重新出现/u.test(tail) && /每[次天晚日周]|每天|总会|卖出|送出|又一次|第二天/u.test(tail) && item) {
    const when = tail.match(/黎明|天亮|黄昏|午夜|清晨|傍晚|打烊|日落|子夜/u)?.[0] || '隔天';
    if (frame?.focus === '炉温') return `${person}认得这只${item}，底下那粒烤焦的盐还是昨晚留下的。第二回把它卖出去前，${person}在底上点了两个眼。${when}再开炉门时，两个眼都在，里面却塞着顾客付的零钱。`;
    return `${person}在${item}背面悄悄留下一道短线，亲手把它送了出去。${when}再看，短线还在，旁边却添了一道更浅的，像是有人也在用同一个法子做记号。`;
  }
  if (/自己|一模一样|我的声|小时候的我/u.test(tail) && /呼号|求救|录音|喊|声音|叫门|通话|电台|信号|敲门/u.test(tail)) {
    if (/叫门|敲门|门外/u.test(tail)) return `${person}没有开门，隔着门板敲了两短一长。那是小时候怕叫醒大人时才用的暗号。外面安静了片刻，把最后一下补全了。`;
    const identifier = tail.match(/呼号|求救声|求救信号|录音|声音/u)?.[0] || '声音';
    return `${person}等那段${identifier}重来，专听换气的地方。短短一停里有一道轻响，是牙齿碰到话筒才会有的声音。${person}把话筒移远了些，这一遍，轻响消失了。`;
  }
  if (/(?:影子|倒影|影像)/u.test(tail) && /没有|消失|映不出|不映出|不见|不肯|留在|丢|慢了|先动/u.test(tail)) {
    return `${person}换了个位置，让光从背后打过来。地上连衣角的轮廓都很清楚，挨着${item || '那东西'}的一小块却是空的。${person}挪开半步，那块空白还是留在原地。`;
  }
  if (/忘记|遗忘|记不起|不记得|忘掉|丢了名字|名字丢了|失去.{0,3}记忆/u.test(tail)) {
    const word = /名字|姓名/u.test(tail) ? '名字' : '那段往事';
    if (says && /[？?]$/u.test(says)) return `${person}本想回答，那个最熟悉的${word}到了嘴边，却只剩下第一个音。对方耐心地等着，竟替${person === '我' ? '我' : person}把第二个音也念了出来。`;
    return `${person}摊开手，凭印象写下${word}，写到一半停住了。手指还知道下一笔该往哪里走，嘴里却已经说不出写的是什么。`;
  }
  if (/最后一班|末班|错过.{0,3}车/u.test(tail) && frame?.focus === '站名') return `${person}看着尾灯缩成一点。站牌背后有人在擦粉笔字，只剩下最后一个时刻还没擦掉，比刚才开走的那班还晚一分钟。`;
  if (/停电|断电|熄灭|停水|冻住|熄火/u.test(tail)) {
    const failure = tail.match(/停电|断电|熄灭|停水|冻住|熄火/u)[0];
    if (['停电','断电','熄灭'].includes(failure)) return `${person}先站着没动。眼睛渐渐适应了黑暗，才看清最远处还有一点亮。那点光很低，随着一个人深一脚浅一脚地靠近。`;
  }
  if (says && /[?？]$/u.test(says)) {
    const key = says.replace(/[?？]$/u,'').slice(-16);
    return `${person}原先已经想好了回答。可那句“${key}”里，有个字听起来和往常不一样。${person}先问了一句：“是谁让你来问的？”`;
  }
  if (says && /别|不要|不许|千万|记得|一定要/u.test(says)) {
    return `话音落下，${person}已经伸出去的手停在半空。方才说话的人却没有等答复，自己先往前跨了一步，把后面的话留得更难开口了。`;
  }
  const goal = tail.match(/(?:想要|决定|必须|一定要|盼着|答应要|只想)([^，。！？；“”\n]{2,20})/u)?.[1];
  if (goal) return `${person}早先只想着${goal}。真到了要动手的时候，才发现有人已经替这件事做了开头，偏偏把最难开口的那一步留了下来。`;
  return '';
}

function familyDrafts() {
  return {words:'爸爸 父亲 爸妈 妈妈 母亲 外婆 外公 祖母 奶奶 爷爷 姐姐 弟弟 团圆 过年 家宴 饭桌 搬家 毕业 婚礼 散伙饭 围裙 饭盒',
    object:'饭盒 围裙 旧照片 照片 空碗 行李箱 饭碗 相册',defaultObject:'照片',focus:'家人',beats:[
      '{人}原本把话都准备好了，开口时却只问了一句吃过没有。对方应了一声，挪出手边一直空着的位置。',
      '“这个你还留着？”{人}问。对方没回答，只把磨得发白的那一面翻过去，露出背后一道歪歪扭扭的铅笔印。',
      '大家以为最惦记这件事的那个人早忘了。等{人}要走，对方才把当年的日子说出来，连星期几都没错。',
      '{人}把要说的话咽回去一半，剩下的一半还是说了出来。许久，对面轻轻应了一声，把两把椅子拉近了一点。'
    ]};
}
