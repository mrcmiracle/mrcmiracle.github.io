/* Sources — the published evidence behind the medical guidance on this site.
 *
 * WHY THIS EXISTS
 * MRC asked that every health claim on the site be traceable to a source a
 * clinician could check. Guidance with no source is an assertion; the reader
 * has no way to tell a guideline from something a student typed.
 *
 * HOW TO USE IT
 * Put data-sources="id id id" on any element. Each id must exist in REFS
 * below. On load, a compact, collapsed "Sources" block is appended to that
 * element listing those references with links to PubMed and the DOI.
 *
 * RULES FOR ADDING A REFERENCE - all three, every time:
 *   1. The reference must EXIST. Every entry here was looked up on PubMed and
 *      its title, journal, year, PMID and DOI copied from the record. Never
 *      write a citation from memory: plausible-looking references that do not
 *      exist are the single worst failure mode for a page like this.
 *   2. It must actually SUPPORT the sentence it is attached to. Do not attach
 *      a review of a topic to a specific number it never reports. If no source
 *      says what the site says, change the site, not the citation. That is why
 *      the earthquake step now reads "cuts and bruises are among the most
 *      common injuries" - the previous "broken glass causes most injuries"
 *      could not be supported by anything found on PubMed.
 *   3. `claim` must describe what the paper actually found, in the reader's
 *      language, so a reader can see WHY it is cited without opening it.
 *
 * `kind` separates the two things a reader should not confuse:
 *   'study'    peer-reviewed research or a clinical practice guideline
 *   'guidance' an official agency instruction (CDC, USGS, state emergency
 *              management). Not a research finding, and labelled as such.
 */
(function (global) {
  'use strict';

  var REFS = {
    /* ---- first aid, general ---- */
    ilcor2020: {
      kind: 'study',
      authors: 'Singletary EM, Zideman DA, Bendall JC, et al.',
      title: '2020 International Consensus on First Aid Science With Treatment Recommendations',
      journal: 'Circulation',
      year: '2020',
      detail: '142(16_suppl_1):S284–S334',
      pmid: '33084394',
      doi: '10.1161/CIR.0000000000000897',
      claim: 'International first aid consensus; direct pressure is the first step for external bleeding.'
    },

    /* ---- burns ---- */
    griffin2020: {
      kind: 'study',
      authors: 'Griffin BR, Frear CC, Babl F, Oakley E, Kimble RM.',
      title: 'Cool running water first aid decreases skin grafting requirements in pediatric burns: a cohort study of 2,495 children',
      journal: 'Annals of Emergency Medicine',
      year: '2020',
      detail: '75(1):75–85',
      pmid: '31474480',
      doi: '10.1016/j.annemergmed.2019.06.028',
      claim: '20 minutes of cool running water within 3 hours lowered the odds of needing a skin graft (OR 0.6) and of a full-thickness burn (OR 0.4).'
    },
    griffin2022: {
      kind: 'study',
      authors: 'Griffin B, Cabilan CJ, Ayoub B, et al.',
      title: 'The effect of 20 minutes of cool running water first aid within three hours of thermal burn injury on patient outcomes: a systematic review and meta-analysis',
      journal: 'Australasian Emergency Care',
      year: '2022',
      detail: '25(4):367–376',
      pmid: '35688782',
      doi: '10.1016/j.auec.2022.05.004',
      claim: 'Pooling seven studies: 20 minutes of cool running water reduced the odds of skin grafting and surgery.'
    },
    isbi2016: {
      kind: 'study',
      authors: 'International Society for Burn Injuries (ISBI) Practice Guidelines Committee.',
      title: 'ISBI Practice Guidelines for Burn Care',
      journal: 'Burns',
      year: '2016',
      detail: '42(5):953–1021',
      pmid: '27542292',
      doi: '10.1016/j.burns.2016.05.013',
      claim: 'International practice guidelines for assessing and treating burns, including which burns need specialist care.'
    },
    cuttle2009: {
      kind: 'study',
      authors: 'Cuttle L, Pearn J, McMillan JR, Kimble RM.',
      title: 'A review of first aid treatments for burn injuries',
      journal: 'Burns',
      year: '2009',
      detail: '35(6):768–775',
      pmid: '19269746',
      doi: '10.1016/j.burns.2008.10.011',
      claim: 'Reviewing water, ice, oils, powders and plant remedies: first aid for burns should be cold running tap water (2–15 °C), not ice or alternative remedies.'
    },
    cuttle2008: {
      kind: 'study',
      authors: 'Cuttle L, Kempf M, Kravchuk O, et al.',
      title: 'The optimal temperature of first aid treatment for partial thickness burn injuries',
      journal: 'Wound Repair and Regeneration',
      year: '2008',
      detail: '16(5):626–634',
      pmid: '19128257',
      doi: '10.1111/j.1524-475X.2008.00413.x',
      claim: 'In an animal (pig) burn model, 20 minutes of cold tap water helped burns heal; the authors conclude ice should not be used.'
    },
    varley2016: {
      kind: 'study',
      authors: 'Varley A, Sarginson J, Young A.',
      title: 'Evidence-based first aid advice for paediatric burns in the United Kingdom',
      journal: 'Burns',
      year: '2016',
      detail: '42(3):571–577',
      pmid: '26655279',
      doi: '10.1016/j.burns.2015.10.029',
      claim: 'Its evidence review concluded: cool the burn with running tap water for 20 minutes, remove clothing and jewellery, and cover it with cling film or a clean non-adhesive dressing.'
    },

    /* ---- plain-language patient sources, for the care box shown with every
       wound result. MedlinePlus is the National Library of Medicine's public
       health encyclopedia: written for patients rather than clinicians, which
       is the right register for a box telling somebody to go and be seen. ---- */
    medlineplus_wounds: {
      kind: 'study',
      authors: 'MedlinePlus, U.S. National Library of Medicine.',
      title: 'Cuts and puncture wounds — when to contact a medical professional',
      journal: 'MedlinePlus Medical Encyclopedia',
      year: '2025',
      url: 'https://medlineplus.gov/ency/article/000043.htm',
      claim: 'Seek care for bleeding that will not stop, and for signs of infection: fever, swelling, a red streak from the wound, or pus.'
    },
    medlineplus_burns: {
      kind: 'study',
      authors: 'MedlinePlus, U.S. National Library of Medicine.',
      title: 'Burns — when to contact a medical professional',
      journal: 'MedlinePlus Medical Encyclopedia',
      year: '2025',
      url: 'https://medlineplus.gov/ency/article/000030.htm',
      claim: 'Call for help when a burn is about the size of your palm or larger, and for burns on the hands, feet, face, groin, buttocks or over a major joint.'
    },

    /* ---- wounds, cuts, infection ---- */
    laceration2017: {
      kind: 'study',
      authors: 'Mankowitz SL.',
      title: 'Laceration management',
      journal: 'The Journal of Emergency Medicine',
      year: '2017',
      detail: '53(3):369–382',
      pmid: '28847677',
      doi: '10.1016/j.jemermed.2017.05.026',
      claim: 'Review of wound care: a moist wound environment matters more than once thought, and antibiotics belong in high-risk wounds such as contaminated, deep and selected bite wounds.'
    },
    idsa2014: {
      kind: 'study',
      authors: 'Stevens DL, Bisno AL, Chambers HF, et al.',
      title: 'Practice guidelines for the diagnosis and management of skin and soft tissue infections: 2014 update by the Infectious Diseases Society of America',
      journal: 'Clinical Infectious Diseases',
      year: '2014',
      detail: '59(2):e10–e52',
      pmid: '24973422',
      doi: '10.1093/cid/ciu444',
      claim: 'National guidelines for skin and soft tissue infection, including bite wounds and when an infected wound needs treatment.'
    },
    tetanus2020: {
      kind: 'study',
      authors: 'Havers FP, Moro PL, Hunter P, Hariri S, Bernstein H.',
      title: 'Use of tetanus toxoid, reduced diphtheria toxoid, and acellular pertussis vaccines: updated recommendations of the Advisory Committee on Immunization Practices — United States, 2019',
      journal: 'MMWR Morbidity and Mortality Weekly Report',
      year: '2020',
      detail: '69(3):77–83',
      pmid: '31971933',
      doi: '10.15585/mmwr.mm6903a5',
      claim: 'US immunisation recommendations, including tetanus boosters given for wound management.'
    },
    cryo2004: {
      kind: 'study',
      authors: 'Hubbard TJ, Denegar CR.',
      title: 'Does cryotherapy improve outcomes with soft tissue injury?',
      journal: 'Journal of Athletic Training',
      year: '2004',
      detail: '39(3):278–279',
      pmid: '15496998',
      claim: 'Review of 22 trials: cold appears to reduce pain, but the trials were small and low quality, and its effect on bruises specifically is not established.'
    },

    /* ---- wildfire smoke ---- */
    reid2016: {
      kind: 'study',
      authors: 'Reid CE, Brauer M, Johnston FH, Jerrett M, Balmes JR, Elliott CT.',
      title: 'Critical review of health impacts of wildfire smoke exposure',
      journal: 'Environmental Health Perspectives',
      year: '2016',
      detail: '124(9):1334–1343',
      pmid: '27082891',
      doi: '10.1289/ehp.1409277',
      claim: 'Consistent evidence links wildfire smoke to breathing problems, especially asthma and COPD flare-ups, with growing evidence on deaths from all causes.'
    },
    cascio2018: {
      kind: 'study',
      authors: 'Cascio WE.',
      title: 'Wildland fire smoke and human health',
      journal: 'Science of the Total Environment',
      year: '2018',
      detail: '624:586–595',
      pmid: '29272827',
      doi: '10.1016/j.scitotenv.2017.12.086',
      claim: 'Susceptible groups include people with lung disease and possibly heart disease, older adults, children, and people who are pregnant.'
    },
    holm2021: {
      kind: 'study',
      authors: 'Holm SM, Miller MD, Balmes JR.',
      title: 'Health effects of wildfire smoke in children and public health tools: a narrative review',
      journal: 'Journal of Exposure Science & Environmental Epidemiology',
      year: '2021',
      detail: '31(1):1–20',
      pmid: '32952154',
      doi: '10.1038/s41370-020-00267-4',
      claim: 'Expected exposure reduction is roughly 20% for a surgical mask against about 80% for an N95 respirator; schools should improve filtration.'
    },
    stauffer2020: {
      kind: 'study',
      authors: 'Stauffer DA, Autenrieth DA, Hart JF, Capoccia S.',
      title: 'Control of wildfire-sourced PM2.5 in an office setting using a commercially available portable air cleaner',
      journal: 'Journal of Occupational and Environmental Hygiene',
      year: '2020',
      detail: '17(4):109–120',
      pmid: '32160140',
      doi: '10.1080/15459624.2020.1722314',
      claim: 'A portable air cleaner cut fine particles in one room by 73% while it was in use and 92% overnight; indoor levels closely tracked outdoor levels.'
    },
    vardoulakis2020: {
      kind: 'study',
      authors: 'Vardoulakis S, Giagloglou E, Steinle S, et al.',
      title: 'Indoor exposure to selected air pollutants in the home environment: a systematic review',
      journal: 'International Journal of Environmental Research and Public Health',
      year: '2020',
      detail: '17(23):8972',
      pmid: '33276576',
      doi: '10.3390/ijerph17238972',
      claim: 'Indoor sources of fine particles include smoking, cooking, heating, incense and candles.'
    },

    /* ---- earthquakes ---- */
    ramirez2005: {
      kind: 'study',
      authors: 'Ramirez M, Peek-Asa C.',
      title: 'Epidemiology of traumatic injuries from earthquakes',
      journal: 'Epidemiologic Reviews',
      year: '2005',
      detail: '27:47–55',
      pmid: '15958426',
      doi: '10.1093/epirev/mxi005',
      claim: 'Review of how and why people are injured in earthquakes.'
    },
    pointer1992: {
      kind: 'study',
      authors: 'Pointer JE, Michaelis J, Saunders C, et al.',
      title: 'The 1989 Loma Prieta earthquake: impact on hospital patient care',
      journal: 'Annals of Emergency Medicine',
      year: '1992',
      detail: '21(10):1228–1233',
      pmid: '1416302',
      doi: '10.1016/s0196-0644(05)81751-2',
      claim: 'Across 51 hospitals, minor trauma was the most common complaint; open wounds, bruises and fractures were the most common diagnoses.'
    },
    peekasa2003: {
      kind: 'study',
      authors: 'Peek-Asa C, Ramirez M, Seligson H, Shoaf K.',
      title: 'Seismic, structural, and individual factors associated with earthquake related injury',
      journal: 'Injury Prevention',
      year: '2003',
      detail: '9(1):62–66',
      pmid: '12642562',
      doi: '10.1136/ip.9.1.62',
      claim: 'After the Northridge earthquake, people over 65 had about 2.9 times the injury risk of younger people.'
    },

    /* ---- official guidance, not research ---- */
    shakeout: {
      kind: 'guidance',
      authors: 'Great ShakeOut Earthquake Drills (Southern California Earthquake Center, with USGS and FEMA).',
      title: 'Drop, Cover, and Hold On',
      journal: 'Official protective-action guidance',
      year: '2025',
      url: 'https://www.shakeout.org/dropcoverholdon/',
      claim: 'The official protective action to take during shaking in the United States.'
    },
    epaSmoke: {
      kind: 'guidance',
      authors: 'U.S. Environmental Protection Agency.',
      title: 'Wildfire Smoke: A Guide for Public Health Officials',
      journal: 'Federal interagency guidance, published via AirNow',
      year: '2021',
      url: 'https://www.airnow.gov/publications/wildfire-smoke-guide/wildfire-smoke-a-guide-for-public-health-officials/',
      claim: 'The federal reference public health agencies use to advise the public during a smoke event.'
    },
    waQuake: {
      kind: 'guidance',
      authors: 'Washington State Military Department, Emergency Management Division.',
      title: 'Preparedness — Be 2 Weeks Ready',
      journal: 'State preparedness guidance',
      year: '2025',
      url: 'https://mil.wa.gov/preparedness',
      claim: 'The state campaign asking Washington households to be ready to be on their own for two weeks.'
    },
    waTsunami: {
      kind: 'guidance',
      authors: 'Washington Geological Survey, Department of Natural Resources.',
      title: 'Tsunamis',
      journal: 'State hazard guidance',
      year: '2025',
      url: 'https://www.dnr.wa.gov/programs-and-services/geology/geologic-hazards/tsunamis',
      claim: 'A strong earthquake near the ocean — one that knocks people down, damages buildings, or lasts a long time — is itself a tsunami warning: go to higher ground.'
    }
  };

  function t(k, fallback) {
    var s = (global.I18N && global.I18N.t) ? global.I18N.t(k) : k;
    return (!s || s === k) ? fallback : s;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* One reference, as a list item. The title links to PubMed where there is a
     PMID, because that is the record a reviewer will want, and to the agency
     page for official guidance. */
  function refItem(id) {
    var r = REFS[id];
    var li = el('li');
    if (!r) {
      // A typo in data-sources must be visible in review, not silently dropped.
      li.appendChild(el('span', 'src-missing', 'Missing reference: ' + id));
      return li;
    }
    var link = el('a', 'src-title', r.title);
    link.href = r.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/' : r.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    li.appendChild(el('span', 'src-authors', r.authors + ' '));
    li.appendChild(link);
    li.appendChild(el('span', 'src-where', '. ' + r.journal + '. ' + r.year +
      (r.detail ? ';' + r.detail : '') + '.'));
    if (r.kind === 'guidance') {
      li.appendChild(el('span', 'src-tag', t('sources.tag.guidance', 'official guidance')));
    }
    if (r.claim) li.appendChild(el('span', 'src-claim', r.claim));

    var ids = el('span', 'src-ids');
    if (r.pmid) {
      var p = el('a', null, 'PubMed ' + r.pmid);
      p.href = 'https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/';
      p.target = '_blank'; p.rel = 'noopener noreferrer';
      ids.appendChild(p);
    }
    if (r.doi) {
      if (r.pmid) ids.appendChild(el('span', 'src-sep', '·'));
      var d = el('a', null, 'doi:' + r.doi);
      d.href = 'https://doi.org/' + r.doi;
      d.target = '_blank'; d.rel = 'noopener noreferrer';
      ids.appendChild(d);
    }
    if (ids.childNodes.length) li.appendChild(ids);
    return li;
  }

  /* Builds the collapsed block. Collapsed by default: the reader in a hurry
     is not made to scroll past a bibliography to reach the next instruction,
     and the reader who wants to check is one tap away. */
  function block(idList) {
    var wrap = el('details', 'srcs');
    var sum = el('summary');
    sum.appendChild(el('span', 'srcs-label', t('sources.h', 'Sources')));
    sum.appendChild(el('span', 'srcs-count', String(idList.length)));
    wrap.appendChild(sum);
    var ul = el('ul', 'src-list');
    idList.forEach(function (id) { ul.appendChild(refItem(id)); });
    wrap.appendChild(ul);
    return wrap;
  }

  function idsOf(host) {
    return (host.getAttribute('data-sources') || '').split(/\s+/).filter(Boolean);
  }

  function paint(root) {
    var hosts = (root || document).querySelectorAll('[data-sources]');
    Array.prototype.forEach.call(hosts, function (host) {
      var existing = host.querySelector(':scope > .srcs');
      if (existing) existing.parentNode.removeChild(existing);
      var ids = idsOf(host);
      if (ids.length) host.appendChild(block(ids));
    });
  }

  /* app.js publishes the dictionary load as I18N.ready, but only once
     DOMContentLoaded has fired - so wait for the document first, THEN for the
     dictionary. Painting earlier would put the raw key on the page. */
  function start() {
    var ready = (global.I18N && global.I18N.ready) || Promise.resolve();
    ready.then(function () { paint(document); }, function () { paint(document); });
    document.addEventListener('i18n:changed', function () { paint(document); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  global.Sources = { refs: REFS, block: block, paint: paint };
}(window));
