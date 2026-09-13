// content/pilots-extractor.js

/**
 * Self-contained tactical extractor for Wanderer Local System Pilots roster.
 * Designed for execution inside browser tabs via chrome.scripting.executeScript.
 * Contains ALL helper functions internally to guarantee zero ReferenceErrors.
 */
export async function extractWandererPilots(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) {
    return { success: false, error: 'NO_DOCUMENT_AVAILABLE', pilots: [] };
  }

  try {
    function clean(str) {
      return (str || '').replace(/\s+/g, ' ').trim();
    }

    const EVE_SHIPS = {"582":"Bantam","583":"Condor","584":"Griffin","585":"Slasher","586":"Probe","587":"Rifter","588":"Reaper","589":"Executioner","590":"Inquisitor","591":"Tormentor","592":"Navitas","593":"Tristan","594":"Incursus","595":"Gallente Police Ship","596":"Impairor","597":"Punisher","598":"Breacher","599":"Burst","600":"Minmatar Peacekeeper Ship","601":"Ibis","602":"Kestrel","603":"Merlin","605":"Heron","606":"Velator","607":"Imicus","608":"Atron","609":"Maulus","613":"Devourer","614":"Fury","615":"Immolator","616":"Medusa","617":"Echo","618":"Lynx","619":"Swordspine","620":"Osprey","621":"Caracal","622":"Stabber","623":"Moa","624":"Maller","625":"Augoror","626":"Vexor","627":"Thorax","628":"Arbitrator","629":"Rupture","630":"Bellicose","631":"Scythe","632":"Blackbird","633":"Celestis","634":"Exequror","635":"Opux Luxury Yacht","638":"Raven","639":"Tempest","640":"Scorpion","641":"Megathron","642":"Apocalypse","643":"Armageddon","644":"Typhoon","645":"Dominix","648":"Badger","649":"Tayra","650":"Nereus","651":"Hoarder","652":"Mammoth","653":"Wreathe","654":"Kryos","655":"Epithal","656":"Miasmos","657":"Iteron Mark V","670":"Capsule","671":"Erebus","672":"Caldari Shuttle","1233":"Polaris Enigma Frigate","1896":"Concord Police Frigate","1898":"Concord SWAT Frigate","1900":"Concord Army Frigate","1902":"Concord Special Ops Frigate","1904":"Concord Police Cruiser","1912":"Concord Police Battleship","1914":"Concord Special Ops Battleship","1916":"Concord SWAT Battleship","1918":"Concord Army Battleship","1944":"Bestower","2006":"Omen","2078":"Zephyr","2161":"Crucifier","2834":"Utu","2836":"Adrestia","2863":"Primae","2998":"Noctis","3514":"Revenant","3516":"Malice","3518":"Vangel","3532":"Echelon","3628":"Nation","3751":"SOCT 1","3753":"SOCT 2","3756":"Gnosis","3764":"Leviathan","3766":"Vigil","3768":"Amarr Police Frigate","4005":"Scorpion Ishukone Watch","4302":"Oracle","4306":"Naga","4308":"Talos","4310":"Tornado","4363":"Miasmos Quafe Ultra Edition","4388":"Miasmos Quafe Ultramarine Edition","9854":"Polaris Inspector Frigate","9858":"Polaris Centurion TEST","9860":"Polaris Legatus Frigate","9862":"Polaris Centurion Frigate","11011":"Guardian-Vexor","11019":"Cockroach","11129":"Gallente Shuttle","11132":"Minmatar Shuttle","11134":"Amarr Shuttle","11172":"Helios","11174":"Keres","11176":"Crow","11178":"Raptor","11182":"Cheetah","11184":"Crusader","11186":"Malediction","11188":"Anathema","11190":"Sentinel","11192":"Buzzard","11194":"Kitsune","11196":"Claw","11198":"Stiletto","11200":"Taranis","11202":"Ares","11365":"Vengeance","11371":"Wolf","11373":"Blade","11375":"Erinye","11377":"Nemesis","11379":"Hawk","11381":"Harpy","11383":"Gatherer","11387":"Hyena","11389":"Kishar","11393":"Retribution","11400":"Jaguar","11567":"Avatar","11936":"Apocalypse Imperial Issue","11938":"Armageddon Imperial Issue","11940":"Gold Magnate","11942":"Silver Magnate","11957":"Falcon","11959":"Rook","11961":"Huginn","11963":"Rapier","11965":"Pilgrim","11969":"Arazu","11971":"Lachesis","11978":"Scimitar","11985":"Basilisk","11987":"Guardian","11989":"Oneiros","11993":"Cerberus","11995":"Onyx","11999":"Vagabond","12003":"Zealot","12005":"Ishtar","12011":"Eagle","12013":"Broadsword","12015":"Muninn","12017":"Devoter","12019":"Sacrilege","12021":"Phobos","12023":"Deimos","12032":"Manticore","12034":"Hound","12036":"Dagger","12038":"Purifier","12042":"Ishkur","12044":"Enyo","12729":"Crane","12731":"Bustard","12733":"Prorator","12735":"Prowler","12743":"Viator","12745":"Occator","12747":"Mastodon","12753":"Impel","13202":"Megathron Federate Issue","16227":"Ferox","16229":"Brutix","16231":"Cyclone","16233":"Prophecy","16236":"Coercer","16238":"Cormorant","16240":"Catalyst","16242":"Thrasher","17360":"Immovable Enigma","17476":"Covetor","17478":"Retriever","17480":"Procurer","17619":"Caldari Navy Hookbill","17634":"Caracal Navy Issue","17636":"Raven Navy Issue","17703":"Imperial Navy Slicer","17705":"Khanid Navy Frigate","17707":"Mordus Frigate","17709":"Omen Navy Issue","17713":"Stabber Fleet Issue","17715":"Gila","17718":"Phantasm","17720":"Cynabal","17722":"Vigilant","17726":"Apocalypse Navy Issue","17728":"Megathron Navy Issue","17732":"Tempest Fleet Issue","17736":"Nightmare","17738":"Machariel","17740":"Vindicator","17812":"Republic Fleet Firetail","17841":"Federation Navy Comet","17843":"Vexor Navy Issue","17918":"Rattlesnake","17920":"Bhaalgorn","17922":"Ashimmu","17924":"Succubus","17926":"Cruor","17928":"Daredevil","17930":"Worm","17932":"Dramiel","19720":"Revelation","19722":"Naglfar","19724":"Moros","19726":"Phoenix","19744":"Sigil","20125":"Curse","20183":"Providence","20185":"Charon","20187":"Obelisk","20189":"Fenrir","21097":"Goru's Shuttle","21628":"Guristas Shuttle","22428":"Redeemer","22430":"Sin","22436":"Widow","22440":"Panther","22442":"Eos","22444":"Sleipnir","22446":"Vulture","22448":"Absolution","22452":"Heretic","22456":"Sabre","22460":"Eris","22464":"Flycatcher","22466":"Astarte","22468":"Claymore","22470":"Nighthawk","22474":"Damnation","22544":"Hulk","22546":"Skiff","22548":"Mackinaw","22852":"Hel","23757":"Archon","23773":"Ragnarok","23911":"Thanatos","23913":"Nyx","23915":"Chimera","23917":"Wyvern","23919":"Aeon","24483":"Nidhoggur","24688":"Rokh","24690":"Hyperion","24692":"Abaddon","24694":"Maelstrom","24696":"Harbinger","24698":"Drake","24700":"Myrmidon","24702":"Hurricane","25560":"Opux Dragoon Yacht","26840":"Raven State Issue","26842":"Tempest Tribal Issue","27299":"Civilian Amarr Shuttle","27301":"Civilian Caldari Shuttle","27303":"Civilian Gallente Shuttle","27305":"Civilian Minmatar Shuttle","28352":"Rorqual","28606":"Orca","28659":"Paladin","28661":"Kronos","28665":"Vargur","28710":"Golem","28844":"Rhea","28846":"Nomad","28848":"Anshar","28850":"Ark","29248":"Magnate","29266":"Apotheosis","29328":"Amarr Media Shuttle","29330":"Caldari Media Shuttle","29332":"Gallente Media Shuttle","29334":"Minmatar Media Shuttle","29336":"Scythe Fleet Issue","29337":"Augoror Navy Issue","29340":"Osprey Navy Issue","29344":"Exequror Navy Issue","29984":"Tengu","29986":"Legion","29988":"Proteus","29990":"Loki","30842":"InterBus Shuttle","32207":"Freki","32209":"Mimir","32305":"Armageddon Navy Issue","32307":"Dominix Navy Issue","32309":"Scorpion Navy Issue","32311":"Typhoon Fleet Issue","32788":"Cambion","32790":"Etana","32811":"Miasmos Amastris Edition","32840":"InterBus Catalyst","32842":"Intaki Syndicate Catalyst","32844":"Inner Zone Shipping Catalyst","32846":"Quafe Catalyst","32848":"Aliastra Catalyst","32872":"Algos","32874":"Dragoon","32876":"Corax","32878":"Talwar","32880":"Venture","32983":"Sukuuvestaa Heron","32985":"Inner Zone Shipping Imicus","32987":"Sarum Magnate","32989":"Vherokior Probe","33079":"Hematos","33081":"Taipan","33083":"Violator","33099":"Nefantar Thrasher","33151":"Brutix Navy Issue","33153":"Drake Navy Issue","33155":"Harbinger Navy Issue","33157":"Hurricane Fleet Issue","33190":"Tash-Murkon Magnate","33328":"Capsule - Genolution 'Auroral' 197-variant","33395":"Moracha","33397":"Chremoas","33468":"Astero","33470":"Stratios","33472":"Nestor","33513":"Leopard","33553":"Stratios Emergency Responder","33623":"Abaddon Tash-Murkon Edition","33625":"Abaddon Kador Edition","33627":"Rokh Nugoeihuvi Edition","33629":"Rokh Wiyrkomi Edition","33631":"Maelstrom Nefantar Edition","33633":"Maelstrom Krusual Edition","33635":"Hyperion Aliastra Edition","33637":"Hyperion Inner Zone Shipping Edition","33639":"Omen Kador Edition","33641":"Omen Tash-Murkon Edition","33643":"Caracal Nugoeihuvi Edition","33645":"Caracal Wiyrkomi Edition","33647":"Stabber Nefantar Edition","33649":"Stabber Krusual Edition","33651":"Thorax Aliastra Edition","33653":"Thorax Inner Zone Shipping Edition","33655":"Punisher Kador Edition","33657":"Punisher Tash-Murkon Edition","33659":"Merlin Nugoeihuvi Edition","33661":"Merlin Wiyrkomi Edition","33663":"Rifter Nefantar Edition","33665":"Rifter Krusual Edition","33667":"Incursus Aliastra Edition","33669":"Incursus Inner Zone Shipping Edition","33673":"Whiptail","33675":"Chameleon","33677":"Police Pursuit Comet","33683":"Mackinaw ORE Development Edition","33685":"Orca ORE Development Edition","33687":"Rorqual ORE Development Edition","33689":"Iteron Inner Zone Shipping Edition","33691":"Tayra Wiyrkomi Edition","33693":"Mammoth Nefantar Edition","33695":"Bestower Tash-Murkon Edition","33697":"Prospect","33816":"Garmur","33818":"Orthrus","33820":"Barghest","33869":"Brutix Serpentis Edition","33871":"Cyclone Thukker Tribe Edition","33873":"Ferox Guristas Edition","33875":"Prophecy Blood Raiders Edition","33877":"Catalyst Serpentis Edition","33879":"Coercer Blood Raiders Edition","33881":"Cormorant Guristas Edition","33883":"Thrasher Thukker Tribe Edition","34118":"Megathron Quafe Edition","34151":"Rattlesnake Victory Edition","34213":"Apocalypse Blood Raider Edition","34215":"Apocalypse Kador Edition","34217":"Apocalypse Tash-Murkon Edition","34219":"Paladin Blood Raider Edition","34221":"Paladin Kador Edition","34223":"Paladin Tash-Murkon Edition","34225":"Raven Guristas Edition","34227":"Raven Kaalakiota Edition","34229":"Raven Nugoeihuvi Edition","34231":"Golem Guristas Edition","34233":"Golem Kaalakiota Edition","34235":"Golem Nugoeihuvi Edition","34237":"Megathron Police Edition","34239":"Megathron Inner Zone Shipping Edition","34241":"Kronos Police Edition","34243":"Kronos Quafe Edition","34245":"Kronos Inner Zone Shipping Edition","34247":"Tempest Justice Edition","34249":"Tempest Krusual Edition","34251":"Tempest Nefantar Edition","34253":"Vargur Justice Edition","34255":"Vargur Krusual Edition","34257":"Vargur Nefantar Edition","34317":"Confessor","34328":"Bowhead","34339":"Moros Interbus Edition","34341":"Naglfar Justice Edition","34343":"Phoenix Wiyrkomi Edition","34345":"Revelation Sarum Edition","34441":"Dominix Quafe Edition","34443":"Tristan Quafe Edition","34445":"Vexor Quafe Edition","34457":"末日沙场级YC117年特别版","34459":"地狱天使级YC117年特别版","34461":"马克瑞级YC117年特别版","34463":"响尾蛇级YC117年特别版","34465":"多米尼克斯级YC117年特别版","34467":"万王宝座级YC117年特别版","34469":"乌鸦级YC117年特别版","34471":"灾难级YC117年特别版","34473":"幼龙级YC117年特别版","34475":"毒蜥级YC117年特别版","34477":"银鹰级YC117年特别版","34479":"伊什塔级YC117年特别版","34496":"Council Diplomatic Shuttle","34562":"Svipul","34590":"Victorieux Luxury Yacht","34828":"Jackdaw","35683":"Hecate","35779":"Imp","35781":"Fiend","37135":"Endurance","37453":"Crucifier Navy Issue","37454":"Vigil Fleet Issue","37455":"Griffin Navy Issue","37456":"Maulus Navy Issue","37457":"Deacon","37458":"Kirin","37459":"Thalia","37460":"Scalpel","37480":"Bifrost","37481":"Pontifex","37482":"Stork","37483":"Magus","37604":"Apostle","37605":"Minokawa","37606":"Lif","37607":"Ninazu","42124":"Vehement","42125":"Vendetta","42126":"Vanquisher","42132":"Vanguard","42133":"Venerable","42241":"Molok","42242":"Dagon","42243":"Chemosh","42244":"Porpoise","42245":"Rabisu","42246":"Caedes","42685":"Sunesis","44993":"Pacifier","44995":"Enforcer","44996":"Marshal","45530":"Virtuoso","45531":"Victor","45534":"Monitor","45645":"Loggerhead","45647":"Caiman","45649":"Komodo","47269":"Damavik","47270":"Vedmak","47271":"Leshak","47466":"Praxis","47727":"GFX Test Vargur 1/2","47728":"GFX Test Vargur 2/2","48635":"Tiamat","48636":"Hydra","48648":"Citizen Venture","49710":"Kikimora","49711":"Drekavac","49712":"Rodiva","49713":"Zarmazd","52250":"Nergal","52252":"Ikitursa","52254":"Draugur","52267":"Test Site Maller","52907":"Zirnitra","54731":"Skybreaker","54732":"Stormbringer","54733":"Thunderchild","58745":"AIR Civilian Astero","60764":"Laelaps","60765":"Raiju","64034":"Boobook","72811":"Cyclone Fleet Issue","72812":"Ferox Navy Issue","72869":"Myrmidon Navy Issue","72872":"Prophecy Navy Issue","72903":"Probe Fleet Issue","72904":"Heron Navy Issue","72907":"Magnate Navy Issue","72913":"Imicus Navy Issue","73787":"Naglfar Fleet Issue","73789":"Coercer Navy Issue","73790":"Revelation Navy Issue","73792":"Moros Navy Issue","73793":"Phoenix Navy Issue","73794":"Thrasher Fleet Issue","73795":"Cormorant Navy Issue","73796":"Catalyst Navy Issue","74141":"Geri","74316":"Bestla","77114":"Metamorphosis","77281":"Hubris","77283":"Bane","77284":"Karura","77288":"Valravn","77726":"Cybele","78333":"Mekubal","78366":"Alligator","78367":"Mamba","78369":"Khizriel","78414":"Shapash","78576":"Azariel","81008":"Squall","81040":"Avalanche","81046":"Deluge","81047":"Torrent","85062":"Sidewinder","85086":"Cenotaph","85087":"Tholos","85229":"Cobra","85236":"Python","87381":"Sarathiel","88001":"Babaroga","89240":"Pioneer","89607":"Odysseus","89647":"Pioneer Consortium Issue","89648":"Venture Consortium Issue","89649":"Outrider","89807":"Anhinga","89808":"Skua","91174":"Perseverance","91775":"Dragoon Navy Issue","91849":"Algos Navy Issue","91857":"Corax Navy Issue","91858":"Talwar Fleet Issue","92282":"Tenzin YC128 Campaign Bus","92283":"Moreau YC128 Campaign Bus","92284":"Roden YC128 Campaign Bus","92822":"Salvation","92823":"Simurgh","92824":"Gaia","92825":"Ymir"};


    /**
     * Walks DOM node tree and extracts text pieces joined by spaces.
     */
    function extractCleanNodeText(el) {
      if (!el) return '';
      const pieces = [];
      function walk(n) {
        if (!n) return;
        if (n.nodeType === 3) {
          const val = (n.nodeValue || '').trim();
          if (val) pieces.push(val);
        } else {
          if (n.tagName && (/^(svg|button)$/i.test(n.tagName) || (n.classList?.contains && n.classList.contains('icon')))) return;
          if (n.childNodes) {
            for (const child of n.childNodes) {
              walk(child);
            }
          }
        }
      }
      walk(el);
      const txt = pieces.join(' ').replace(/\s+/g, ' ').trim();
      return txt || (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extracts direct image URL from an img element or background-image CSS.
     */
    function extractMediaUrl(el) {
      if (!el) return '';
      // 1. Direct element with src or child img
      const directSrc = el.getAttribute?.('src') || el.src || el.getAttribute?.('data-src') || el.currentSrc || '';
      if (directSrc && !directSrc.startsWith('data:') && !/\/types\//i.test(directSrc) && !/\/brackets\//i.test(directSrc)) {
        return directSrc;
      }
      const img = el.tagName?.toLowerCase() === 'img' ? el : el.querySelector?.('img');
      if (img) {
        const src = img.getAttribute?.('src') || img.src || img.getAttribute?.('data-src') || img.currentSrc || '';
        if (src && !src.startsWith('data:') && !/\/types\//i.test(src) && !/\/brackets\//i.test(src)) {
          return src;
        }
      }

      // 2. CSS background-image
      const candidates = [el, ...Array.from(el.querySelectorAll?.('*') || [])];
      for (const b of candidates) {
        const style = b.getAttribute?.('style') || '';
        const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (match && !/\/types\//i.test(match[1]) && !/\/brackets\//i.test(match[1])) {
          return match[1];
        }
        if (typeof window !== 'undefined' && window.getComputedStyle) {
          try {
            const comp = window.getComputedStyle(b).backgroundImage;
            const compMatch = (comp || '').match(/url\(['"]?([^'")]+)['"]?\)/i);
            if (compMatch && compMatch[1] && compMatch[1] !== 'none' && !/\/types\//i.test(compMatch[1]) && !/\/brackets\//i.test(compMatch[1])) {
              return compMatch[1];
            }
          } catch {}
        }
      }

      return '';
    }

    // Search roots: main document and any accessible iframes
    const searchRoots = [doc];
    const iframes = Array.from(doc.querySelectorAll?.('iframe') || []);
    for (const f of iframes) {
      try {
        if (f.contentDocument) searchRoots.push(f.contentDocument);
      } catch {}
    }

    let detectedSystem = 'Unknown';
    let detectedClass = 'Unknown';
    let matchedHeaderEl = null;
    let localCount = null;

    // --- PHASE 1: Resolve Active System and Wormhole Class ---
    // Priority 1: Check Signatures panel if open on the same page
    for (const root of searchRoots) {
      const allEls = Array.from(root.querySelectorAll('*'));
      for (const el of allEls) {
        if (/Signatures\s*in/i.test(el.textContent)) {
          const txt = extractCleanNodeText(el);
          if (txt.length < 200) {
            const match = txt.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
            if (match) {
              detectedClass = match[1].toUpperCase();
              detectedSystem = match[2].toUpperCase();
              break;
            }
          }
        }
      }
      if (detectedSystem !== 'Unknown') break;
    }

    // Priority 2: Check active/selected node in SVG canvas
    if (detectedSystem === 'Unknown') {
      for (const root of searchRoots) {
        const activeNode = root.querySelector?.('.system-node.active, g.active, [aria-selected="true"]');
        if (activeNode) {
          const nodeText = extractCleanNodeText(activeNode);
          const jMatch = nodeText.match(/\b(J\d{6})\b/i);
          if (jMatch) detectedSystem = jMatch[1].toUpperCase();
          const cMatch = nodeText.match(/\b(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\b/i);
          if (cMatch) detectedClass = cMatch[1].toUpperCase();
        }
      }
    }

    // Priority 3: Fallback from document title
    if (detectedSystem === 'Unknown') {
      const titleMatch = (doc.title || '').match(/\b(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})\b/i);
      if (titleMatch) detectedSystem = titleMatch[1].toUpperCase();
      const titleClass = (doc.title || '').match(/\b(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\b/i);
      if (titleClass) detectedClass = titleClass[1].toUpperCase();
    }

    // --- PHASE 2: Locate Local [n] Header Element ---
    for (const root of searchRoots) {
      const candidates = Array.from(root.querySelectorAll('*')).filter(el => {
        // Exclude buttons, form inputs, scripts
        if (el.tagName && /^(button|input|select|textarea|script|style)$/i.test(el.tagName)) return false;
        const txt = (el.textContent || '').trim();
        return /Local\s*\[\s*\d+\s*\]/i.test(txt) && txt.length < 60;
      });
      // Pick innermost element (shortest textContent)
      candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      if (candidates.length > 0) {
        matchedHeaderEl = candidates[0];
        const match = matchedHeaderEl.textContent.match(/Local\s*\[\s*(\d+)\s*\]/i);
        if (match) localCount = parseInt(match[1], 10);
        break;
      }
    }

    if (!matchedHeaderEl) {
      return {
        success: false,
        error: 'NO_LOCAL_PANEL_DETECTED',
        message: 'No open Local panel detected. Ensure the Local roster panel is open in Wanderer.',
        pilots: []
      };
    }

    // If localCount is explicitly 0, local is clear
    if (localCount === 0) {
      return {
        success: true,
        system: detectedSystem,
        class: detectedClass,
        count: 0,
        pilots: [],
        message: `Local is clear (0 pilots in ${detectedSystem} (${detectedClass})).`
      };
    }

    // --- PHASE 3: Bound the Local Panel Container ---
    let localCard = matchedHeaderEl;
    while (
      localCard.parentElement &&
      localCard.parentElement !== doc.body &&
      !localCard.parentElement.querySelector?.('table') &&
      !/Signatures\s*in/i.test(localCard.parentElement.textContent || '')
    ) {
      localCard = localCard.parentElement;
    }

    // Fallback: If localCard is still just the header itself or has no images/content, check closest panel/card
    if (localCard === matchedHeaderEl || (localCard.querySelectorAll?.('img')?.length === 0 && !/\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(localCard.textContent || ''))) {
      const closestPanel = matchedHeaderEl.closest?.('.panel, .card, [class*="panel"], [class*="card"], [class*="widget"]');
      if (closestPanel && !closestPanel.querySelector?.('table')) {
        localCard = closestPanel;
      } else if (matchedHeaderEl.parentElement && !matchedHeaderEl.parentElement.querySelector?.('table')) {
        localCard = matchedHeaderEl.parentElement;
      }
    }

    // Check Wanderer's "Ship name" toggle state in localCard header & auto-enable if unchecked
    let shipNamesToggled = null;
    let autoCheckedShipNames = false;
    try {
      if (localCard) {
        const toggleCandidates = Array.from(localCard.querySelectorAll?.('*') || []);
        for (const el of toggleCandidates) {
          const txt = (el.textContent || '').trim();
          if (/^Ship\s*names?$/i.test(txt)) {
            const parent = el.parentElement;
            const chk = parent?.querySelector?.('input[type="checkbox"]') || el.querySelector?.('input[type="checkbox"]');
            if (chk) {
              shipNamesToggled = Boolean(chk.checked);
              if (!chk.checked && typeof chk.click === 'function') {
                try {
                  chk.click();
                  autoCheckedShipNames = true;
                  shipNamesToggled = true;
                } catch {}
              }
            } else {
              const btn = parent?.querySelector?.('[role="checkbox"]') || el.querySelector?.('[role="checkbox"]');
              if (btn) {
                shipNamesToggled = btn.getAttribute?.('aria-checked') === 'true';
                if (!shipNamesToggled && typeof btn.click === 'function') {
                  try {
                    btn.click();
                    autoCheckedShipNames = true;
                    shipNamesToggled = true;
                  } catch {}
                }
              } else {
                const html = (parent ? parent.innerHTML : el.innerHTML) || '';
                const isChecked = /checked|active|text-blue|bg-blue|lucide-check|check-square/i.test(html);
                shipNamesToggled = isChecked;
                if (!isChecked) {
                  const clickable = el.nextElementSibling || parent?.querySelector?.('button, [class*="toggle"], [class*="checkbox"]');
                  if (clickable && typeof clickable.click === 'function') {
                    try {
                      clickable.click();
                      autoCheckedShipNames = true;
                      shipNamesToggled = true;
                    } catch {}
                  }
                }
              }
            }
            break;
          }
        }
      }
    } catch {}

    if (autoCheckedShipNames) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }

    // Helper: Recursively search React fiber or props object for ship name
    function searchReactObjectForShipName(obj, depth = 0) {
      if (!obj || depth > 4 || typeof obj !== 'object') return null;
      try {
        const candidates = [
          obj.pilot?.ship?.name,
          obj.pilot?.ship_name,
          obj.pilot?.shipName,
          obj.character?.ship?.name,
          obj.character?.ship_name,
          obj.ship?.name,
          obj.ship_name,
          obj.shipName
        ];
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim().length > 0) {
            return c.trim();
          }
        }
        if (obj.memoizedProps) {
          const res = searchReactObjectForShipName(obj.memoizedProps, depth + 1);
          if (res) return res;
        }
        if (obj.props) {
          const res = searchReactObjectForShipName(obj.props, depth + 1);
          if (res) return res;
        }
      } catch {}
      return null;
    }

    // Helper: Search DOM elements for React fiber/props containing custom ship names
    function findCustomShipNameInReact(rowEl, candidateEls) {
      if (!rowEl) return null;
      const elements = [rowEl, ...(candidateEls || [])];
      for (const el of elements) {
        if (!el) continue;
        try {
          const keys = Object.keys(el);
          for (const k of keys) {
            if (k.startsWith('__reactProps$') || k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) {
              const val = el[k];
              const name = searchReactObjectForShipName(val, 0);
              if (name) return name;
            }
          }
        } catch {}
      }
      return null;
    }

    // --- PHASE 4: Extract Pilot Entries ---
    const pilots = [];

    // Helper to evaluate and add a pilot row
    function processPilotCandidate(rowEl, pImg = null) {
      if (!rowEl) return;
      // STRICT ISOLATION: Reject any element inside tables or matching other panels
      if ((rowEl.closest && rowEl.closest('table')) || (rowEl.querySelector && rowEl.querySelector('table'))) return;
      const rowText = extractCleanNodeText(rowEl);
      if (/BSG-\d{3}|RIS-\d{3}|SVG-\d{3}|ZCD-\d{3}|ZCG-\d{3}/i.test(rowText)) return;
      if (/Fortizar|Raitaru|Athanor|Keepstar|Astrahus/i.test(rowText)) return;
      if (/\b(?:Korsiki|Wuos|Harerget|Ardallabier|Azer|Lirsautton)\b/i.test(rowText)) return;
      if (/Signatures\s*in/i.test(rowText)) return;

      // 1. Portrait URL
      let portraitUrl = '';
      if (pImg) {
        portraitUrl = extractMediaUrl(pImg) || pImg.getAttribute?.('src') || pImg.src || '';
      }
      if (!portraitUrl) {
        // Look inside rowEl for character portrait
        const imgCandidates = [];
        try {
          const imgs = rowEl.querySelectorAll?.('img');
          if (imgs) imgCandidates.push(...Array.from(imgs));
        } catch {}
        try {
          const styled = rowEl.querySelectorAll?.('[style*="url"], [style*="background"], [class*="portrait"], [class*="avatar"]');
          if (styled) {
            for (const el of styled) {
              if (!imgCandidates.includes(el)) imgCandidates.push(el);
            }
          }
        } catch {}

        for (const c of imgCandidates) {
          const url = extractMediaUrl(c);
          if (url && (/characters/i.test(url) || /character/i.test(url) || c.classList?.contains?.('portrait') || c.closest?.('[class*="portrait"], [class*="avatar"]'))) {
            portraitUrl = url;
            break;
          }
        }
        if (!portraitUrl && imgCandidates.length > 0) {
          for (const c of imgCandidates) {
            const url = extractMediaUrl(c);
            if (url && !/\/types\//i.test(url) && !/\/brackets\//i.test(url)) {
              portraitUrl = url;
              break;
            }
          }
        }
      }

      // 2. Pilot Name and Corp Ticker
      // Supports "Pilot Name [CORP]" and "Pilot Name [ CORP ]" with spaces
      let pilotName = '';
      let corpTicker = '';

      const corpMatch = rowText.match(/([A-Za-z0-9 '\-_]+?)\s*\[\s*([A-Za-z0-9.\-_]{2,10})\s*\]/);
      if (corpMatch) {
        pilotName = clean(corpMatch[1]);
        corpTicker = clean(corpMatch[2]);
      } else {
        const nameEl = rowEl.querySelector?.('.pilot-name, [class*="name"]');
        if (nameEl) {
          pilotName = clean(extractCleanNodeText(nameEl));
        } else {
          pilotName = clean(rowText.split(/\s{2,}|\n/)[0]);
        }
      }

      // Reject non-pilot rows or UI headers
      if (!pilotName || /^(Fortizar|Raitaru|Athanor|Type|Id|Group|Info|Local|Signatures|Timer|Owner)$/i.test(pilotName)) return;
      if (pilotName.length < 2 || pilotName.length > 60) return;

      // 3. Ship Name
      let shipName = '';
      const shipNameEl = rowEl.querySelector?.('.ship-name, [class*="ship-name"]');
      if (shipNameEl) {
        shipName = clean(extractCleanNodeText(shipNameEl));
      } else if (corpMatch) {
        const afterCorp = clean(rowText.substring(corpMatch.index + corpMatch[0].length));
        if (afterCorp) {
          shipName = afterCorp;
        }
      }

      // 4. Resolve Ship Type via EVE Type ID or known hulls
      let shipType = '';
      const candidateSet = new Set([
        rowEl,
        ...Array.from(rowEl.querySelectorAll?.('*') || []),
        ...Array.from(rowEl.querySelectorAll?.('img') || []),
        ...Array.from(rowEl.querySelectorAll?.('[title], [alt], [data-tooltip], [aria-label]') || [])
      ]);
      const allRowCandidateEls = Array.from(candidateSet);

      function matchEveTypeId(str) {
        if (!str) return null;
        const m = str.match(/\/types\/(\d+)/i) || str.match(/\/type\/(\d+)/i);
        if (m && EVE_SHIPS[m[1]]) {
          return EVE_SHIPS[m[1]];
        }
        return null;
      }

      // 4a. Check src, data-src, currentSrc, href, style, and data attributes for /types/{typeId}/
      for (const el of allRowCandidateEls) {
        if (el === pImg) continue;
        if (pImg && (el.contains?.(pImg) || pImg.contains?.(el))) continue;
        if (el.closest?.('[class*="portrait"], [class*="avatar"], [class*="pilot-image"], [class*="pilot-portrait"]')) continue;

        // Check image src / data-src / currentSrc / href
        const src = el.getAttribute?.('src') || el.src || el.getAttribute?.('data-src') || el.currentSrc || el.getAttribute?.('href') || '';
        let found = matchEveTypeId(src);
        if (found) {
          shipType = found;
          break;
        }

        // Check inline style (e.g. background-image: url('.../types/33470/icon'))
        const style = el.getAttribute?.('style') || '';
        found = matchEveTypeId(style);
        if (found) {
          shipType = found;
          break;
        }

        // Check computed style for background-image
        if (typeof window !== 'undefined' && window.getComputedStyle) {
          try {
            const comp = window.getComputedStyle(el).backgroundImage || '';
            found = matchEveTypeId(comp);
            if (found) {
              shipType = found;
              break;
            }
          } catch {}
        }

        // Check data attributes like data-type-id, data-type, data-item-id
        const dataId = el.getAttribute?.('data-type-id') || el.getAttribute?.('data-type') || el.getAttribute?.('data-item-id') || '';
        if (dataId && EVE_SHIPS[dataId]) {
          shipType = EVE_SHIPS[dataId];
          break;
        }
      }

      // 4b. If not resolved from type ID, check tooltips, titles, alt, aria-label, data-tooltip
      if (!shipType) {
        for (const el of allRowCandidateEls) {
          if (el === pImg) continue;
          if (pImg && (el.contains?.(pImg) || pImg.contains?.(el))) continue;
          if (el.closest?.('[class*="portrait"], [class*="avatar"], [class*="pilot-image"], [class*="pilot-portrait"]')) continue;

          const rawTitle = el.getAttribute?.('title') ||
                           el.getAttribute?.('alt') ||
                           el.getAttribute?.('data-ship-type') ||
                           el.getAttribute?.('aria-label') ||
                           el.getAttribute?.('data-tooltip') ||
                           el.closest?.('[title]')?.getAttribute?.('title') ||
                           el.closest?.('[data-tooltip]')?.getAttribute?.('data-tooltip') || '';

          if (!rawTitle) continue;

          let title = clean(rawTitle);

          // Strip pilot name if present in title
          if (pilotName) {
            if (title.toLowerCase() === pilotName.toLowerCase()) continue;
            title = clean(title.split(pilotName).join(''));
            title = title.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
          }

          // Strip corp ticker if present in title
          if (corpTicker) {
            if (title.toLowerCase() === corpTicker.toLowerCase()) continue;
            title = clean(title.split(corpTicker).join(''));
            title = title.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
          }

          // Strip shipName if it matches title (e.g. ship name tooltip)
          if (shipName && title.toLowerCase() === shipName.toLowerCase()) continue;

          if (!title || /^(portrait|avatar|close|edit|delete|dock|undock|docked|undocked|station|structure|ship\s*name)$/i.test(title)) {
            continue;
          }

          // Check if matches an exact known ship hull
          const matchedHull = Object.values(EVE_SHIPS).find(h => h.toLowerCase() === title.toLowerCase());
          if (matchedHull) {
            shipType = matchedHull;
            break;
          }

          if (!shipType && title.length >= 3 && title.length <= 40) {
            shipType = title;
          }
        }
      }

      // 5. Fallback: Infer shipType from shipName if known hull
      if (!shipType && shipName) {
        if (/^Capsule/i.test(shipName)) {
          shipType = 'Capsule';
        } else if (/^Nemesis/i.test(shipName)) {
          shipType = 'Nemesis';
        } else if (/^Hound/i.test(shipName)) {
          shipType = 'Hound';
        } else if (/^Purifier/i.test(shipName)) {
          shipType = 'Purifier';
        } else if (/^Manticore/i.test(shipName)) {
          shipType = 'Manticore';
        } else {
          const exactHull = Object.values(EVE_SHIPS).find(h => h.toLowerCase() === shipName.toLowerCase());
          if (exactHull) {
            shipType = exactHull;
          } else {
            const dashParts = shipName.split(/\s*-\s*/);
            if (dashParts.length > 1 && dashParts[0].length >= 3) {
              const possible = clean(dashParts[0]);
              const found = Object.values(EVE_SHIPS).find(v => v.toLowerCase() === possible.toLowerCase());
              if (found) {
                shipType = found;
              }
            }
          }
        }
      }

      // 6. If shipName currently matches shipType (e.g. "Ship name" checkbox was unchecked in Wanderer),
      // check if the custom ship name is stored in React memory, title attributes, or data attributes
      if (shipName && shipType && shipName.toLowerCase() === shipType.toLowerCase()) {
        try {
          const reactCustomName = findCustomShipNameInReact(rowEl, allRowCandidateEls);
          if (reactCustomName && reactCustomName.toLowerCase() !== shipType.toLowerCase()) {
            shipName = reactCustomName;
          }
        } catch {}

        if (shipName.toLowerCase() === shipType.toLowerCase()) {
          for (const el of allRowCandidateEls) {
            if (el === pImg) continue;
            const t = el.getAttribute?.('title') ||
                      el.getAttribute?.('data-ship-name') ||
                      el.getAttribute?.('data-tag') ||
                      el.getAttribute?.('data-name') || '';
            if (!t) continue;
            const cleaned = clean(t);
            if (cleaned && cleaned.toLowerCase() !== shipType.toLowerCase() &&
                cleaned.toLowerCase() !== pilotName.toLowerCase() &&
                cleaned.toLowerCase() !== corpTicker.toLowerCase() &&
                !/^(portrait|avatar|close|edit|delete|dock|undock|docked|undocked|station|structure|ship\s*name)$/i.test(cleaned)) {
              shipName = cleaned;
              break;
            }
          }
        }
      }

      // 7. Ensure both shipName and shipType are populated
      if (shipName) {
        shipName = clean(shipName.replace(/[\s\-–—:]+$/, ''));
      }
      if (!shipName || shipName === '-') {
        shipName = shipType || '-';
      }
      if (!shipType || shipType === '-') {
        shipType = shipName || '-';
      }

      if (pilotName && !pilots.some(p => p.pilot === pilotName)) {
        pilots.push({
          pilot: pilotName,
          corp: corpTicker,
          shipName: shipName || '-',
          shipType: shipType || '-',
          portraitUrl
        });
      }
    }

    // Strategy 1: Find character portraits inside localCard
    let portraitCandidates = [];
    try {
      const imgs = Array.from(localCard.querySelectorAll('img') || []);
      portraitCandidates.push(...imgs);
    } catch {}
    try {
      const bgEls = Array.from(localCard.querySelectorAll('[style*="url"], [style*="background"], [class*="portrait"], [class*="avatar"]') || []);
      for (const el of bgEls) {
        if (!portraitCandidates.includes(el)) portraitCandidates.push(el);
      }
    } catch {}

    let portraitImgs = portraitCandidates.filter(el => {
      const src = extractMediaUrl(el) || (el.getAttribute && el.getAttribute('src')) || el.src || '';
      if (!src) return false;
      if (/\/types\//i.test(src) || /\/brackets\//i.test(src)) return false;
      return /characters/i.test(src) || /character/i.test(src) ||
             el.classList?.contains?.('portrait') ||
             el.classList?.contains?.('avatar') ||
             el.parentElement?.classList?.contains?.('pilot-portrait') ||
             el.closest?.('[class*="portrait"], [class*="avatar"]');
    });

    if (portraitImgs.length === 0) {
      portraitImgs = portraitCandidates.filter(el => {
        const src = extractMediaUrl(el) || (el.getAttribute && el.getAttribute('src')) || el.src || '';
        if (!src) return false;
        return !/\/types\//i.test(src) && !/\/brackets\//i.test(src) && !/\/icons\//i.test(src);
      });
    }

    for (const pImg of portraitImgs) {
      // Find the outermost element representing this single pilot's row
      // Climb up until rowEl.parentElement contains multiple pilot portraits or is localCard/body
      let rowEl = pImg;
      while (rowEl && rowEl.parentElement && rowEl.parentElement !== localCard && rowEl.parentElement !== doc.body) {
        let multiPortraits = false;
        try {
          if (typeof rowEl.parentElement.contains === 'function') {
            const contained = portraitImgs.filter(img => {
              try { return rowEl.parentElement.contains(img); } catch { return false; }
            });
            if (contained.length > 1) multiPortraits = true;
          } else if (rowEl.parentElement.querySelectorAll) {
            const imgs = Array.from(rowEl.parentElement.querySelectorAll('img') || []);
            const pCount = imgs.filter(i => /characters/i.test(i.getAttribute?.('src') || i.src || '')).length;
            if (pCount > 1) multiPortraits = true;
          }
        } catch {}
        if (multiPortraits) {
          // rowEl.parentElement contains multiple pilots, so rowEl is THIS pilot's full row container!
          break;
        }
        // Don't climb into tables or header containers
        if (rowEl.parentElement.querySelector?.('table')) break;
        if (/Local\s*\[/i.test(rowEl.parentElement.textContent || '') && rowEl.parentElement.querySelector?.('button, input, [class*="header"]')) {
          break;
        }
        // If rowEl already has corp ticker and parent has no corp ticker, don't climb further
        const currentText = extractCleanNodeText(rowEl);
        const parentText = extractCleanNodeText(rowEl.parentElement);
        if (/\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(currentText) && !/\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(parentText)) {
          break;
        }
        rowEl = rowEl.parentElement;
      }
      processPilotCandidate(rowEl || pImg.parentElement || localCard, pImg);
    }

    // Strategy 2: If no pilots found via portraits, find elements with [CORP] ticker in localCard
    if (pilots.length === 0) {
      const allCardEls = Array.from(localCard.querySelectorAll('*'));
      const corpCandidates = allCardEls.filter(el => {
        if (el === matchedHeaderEl || (el.contains && el.contains(matchedHeaderEl))) return false;
        if (el.closest && el.closest('table')) return false;
        const txt = (el.textContent || '').trim();
        return /\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(txt) && txt.length < 150;
      });
      // Take innermost matching elements
      const innermost = corpCandidates.filter(el => !corpCandidates.some(other => other !== el && el.contains && el.contains(other)));
      for (const el of innermost) {
        let rowEl = el;
        // Walk up to find the full row containing images or multiple siblings
        while (rowEl && rowEl.parentElement && rowEl.parentElement !== localCard && rowEl.parentElement !== doc.body) {
          const parentPilots = Array.from(rowEl.parentElement.children).filter(c => /\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(c.textContent || ''));
          if (parentPilots.length > 1) break;
          if (rowEl.parentElement.querySelector?.('table')) break;
          rowEl = rowEl.parentElement;
        }
        processPilotCandidate(rowEl || el);
      }
    }

    // Strategy 3: Page-wide fallback for elements with [CORP] ticker strictly outside tables
    if (pilots.length === 0) {
      for (const root of searchRoots) {
        const allPageEls = Array.from(root.querySelectorAll('*'));
        const corpPageEls = allPageEls.filter(el => {
          if (el.closest && el.closest('table')) return false;
          if (el.querySelector && el.querySelector('table')) return false;
          const txt = (el.textContent || '').trim();
          if (/Signatures\s*in|Structures/i.test(txt)) return false;
          return /\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(txt) && txt.length < 120;
        });
        const innermost = corpPageEls.filter(el => !corpPageEls.some(other => other !== el && el.contains && el.contains(other)));
        for (const el of innermost) {
          let rowEl = el;
          while (rowEl && rowEl.parentElement && rowEl.parentElement !== doc.body) {
            const parentPilots = Array.from(rowEl.parentElement.children).filter(c => /\[\s*[A-Za-z0-9.\-_]{2,10}\s*\]/.test(c.textContent || ''));
            if (parentPilots.length > 1) break;
            if (rowEl.parentElement.querySelector?.('table')) break;
            rowEl = rowEl.parentElement;
          }
          processPilotCandidate(rowEl || el);
        }
        if (pilots.length > 0) break;
      }
    }

    const success = pilots.length > 0 || localCount === 0;

    return {
      success,
      system: detectedSystem,
      class: detectedClass,
      count: pilots.length,
      shipNamesToggled,
      autoCheckedShipNames,
      pilots,
      message: pilots.length > 0
        ? `Successfully extracted ${pilots.length} pilots from Local roster.`
        : (localCount === 0 
            ? `Local is clear (0 pilots in ${detectedSystem} (${detectedClass})).`
            : `Detected Local [${localCount !== null ? localCount : '?'}], but no pilot rows could be parsed.`),
      debug: {
        url: doc.location?.href || 'unknown',
        headerFound: !!matchedHeaderEl,
        headerText: matchedHeaderEl ? matchedHeaderEl.textContent.trim().substring(0, 60) : 'None',
        localCount,
        localCardTag: localCard ? localCard.tagName : 'None',
        localCardClass: localCard ? (localCard.className || '') : '',
        portraitsFound: portraitImgs.length,
        pilotsFound: pilots.length
      }
    };

  } catch (err) {
    return {
      success: false,
      error: 'EXTRACTION_EXCEPTION',
      message: `Extractor error: ${err.message}`,
      pilots: [],
      debug: {
        exception: err.stack || err.message
      }
    };
  }
}

/**
 * Tactical regex-based HTML extractor for tests and environments without full DOM.
 */
export function extractWandererPilotsFromHtml(htmlString) {
  if (!htmlString || !/Local\s*\[\s*\d+\s*\]/i.test(htmlString)) {
    return {
      success: false,
      error: 'NO_LOCAL_PANEL_DETECTED',
      pilots: []
    };
  }

  // Clean text for system/class identification
  const spacedHtml = htmlString.replace(/<\/?[^>]+(>|$)/g, ' ');
  const cleanText = spacedHtml.replace(/\s+/g, ' ').trim();

  let systemClass = 'Unknown';
  let system = 'Unknown';

  const sigMatch = cleanText.match(/(?:Signatures\s*)?in\s*(C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\s*(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})/i);
  if (sigMatch) {
    systemClass = sigMatch[1].toUpperCase();
    system = sigMatch[2].toUpperCase();
  } else {
    const locMatch = cleanText.match(/(J\d{6}|[0-9A-Z]{1,4}-[0-9A-Z]{1,4})\s*\((C[1-6]|Highsec|Lowsec|Nullsec|Pochven)\)/i);
    if (locMatch) {
      system = locMatch[1].toUpperCase();
      systemClass = locMatch[2].toUpperCase();
    } else {
      const titleMatch = cleanText.match(/\b(C[1-6])\s*(J\d{6})\b/i);
      if (titleMatch) {
        systemClass = titleMatch[1].toUpperCase();
        system = titleMatch[2].toUpperCase();
      }
    }
  }

  // Isolate the Local [n] section: find position of Local [n]
  const localIdx = htmlString.search(/Local\s*\[\s*\d+\s*\]/i);
  if (localIdx === -1) {
    return { success: false, error: 'NO_LOCAL_PANEL_DETECTED', pilots: [] };
  }

  const countMatch = htmlString.match(/Local\s*\[\s*(\d+)\s*\]/i);
  const localCount = countMatch ? parseInt(countMatch[1], 10) : null;
  if (localCount === 0) {
    return {
      success: true,
      system,
      class: systemClass,
      count: 0,
      pilots: []
    };
  }

  // Take the section starting at Local [n]
  const localSection = htmlString.substring(localIdx);
  // Cut off if another major panel starts or body ends
  const localChunk = localSection.split(/<div class="panel (?:signatures|structures|route)|<table|<\/body/i)[0];

  // Extract pilot entries from the local chunk
  const pilots = [];
  const rawParts = localChunk.split(/(?=<[^>]*class=["'][^"']*(?:pilot-row|pilot-entry))/i);

  for (const part of rawParts) {
    if (!/class=["'][^"']*(?:pilot-row|pilot-entry)/i.test(part)) continue;
    const blockContent = part.split(/<div class="panel|<footer|<\/body/i)[0];

    // Reject any table row or structure
    if (/<tr|<table|BSG-\d{3}|Fortizar/i.test(blockContent)) continue;

    // 1. Portrait
    const portraitMatch = blockContent.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
    const portraitUrl = portraitMatch ? portraitMatch[1] : '';

    // 2. Pilot Name and Corp
    let pilot = '';
    let corp = '';
    const nameMatch = blockContent.match(/class=["'][^"']*(?:pilot-name|title|name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i) ||
                      blockContent.match(/([A-Za-z0-9 '\-_]+?)\s*\[\s*([A-Za-z0-9.\-_]{2,10})\s*\]/);

    if (nameMatch) {
      const raw = nameMatch[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
      const splitCorp = raw.match(/^([A-Za-z0-9 '\-_]+?)(?:\s*\[\s*([A-Za-z0-9.\-_]{2,10})\s*\])?$/);
      if (splitCorp) {
        pilot = splitCorp[1].trim();
        corp = splitCorp[2] ? splitCorp[2].trim() : '';
      } else {
        pilot = raw;
      }
    }

    // 3. Ship Name
    let shipName = '';
    const shipNameMatch = blockContent.match(/class=["'][^"']*(?:ship-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i) ||
                          blockContent.match(/<span>(Capsule[^<]*|Into[^<]*|Never[^<]*|[A-Za-z0-9 '\-_]+)<\/span>/i);
    if (shipNameMatch) {
      shipName = shipNameMatch[1].replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 4. Ship Type
    let shipType = '';
    const shipIconMatch = blockContent.match(/<img[^>]*(?:class=["'][^"']*ship-icon[^"']*["'][^>]*title=["']([^"']+)["']|title=["']([^"']+)["'][^>]*class=["'][^"']*ship-icon[^"']*["'])/i) ||
                          blockContent.match(/title=["'](Capsule|Nemesis|Hound|Purifier|Manticore|[A-Za-z0-9\-]+)["']/i);
    if (shipIconMatch) {
      shipType = shipIconMatch[1] || shipIconMatch[2];
    }

    if (!shipType && shipName) {
      if (/^Capsule/i.test(shipName)) shipType = 'Capsule';
      else if (/^Nemesis/i.test(shipName)) shipType = 'Nemesis';
      else if (/^Hound/i.test(shipName)) shipType = 'Hound';
    }

    if (pilot && !pilots.some(p => p.pilot === pilot)) {
      pilots.push({
        pilot,
        corp,
        shipName: shipName || '-',
        shipType: shipType || '-',
        portraitUrl
      });
    }
  }

  return {
    success: pilots.length > 0,
    system,
    class: systemClass,
    count: pilots.length,
    pilots
  };
}
