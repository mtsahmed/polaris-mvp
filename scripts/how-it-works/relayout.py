"""One-off: re-apply the compact layout (16-17 November 2026) on top of the owner's tour version of
public/how-it-works.html, add the sign-in row under the step panel and the height report for embedding.
Run once:  python -I scripts/how-it-works/relayout.py public/how-it-works.html
Kept in the repo as a record of what changed; make-light.py is the script that stays in use."""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()

def rep(old, new):
    global s
    assert s.count(old) == 1, old
    s = s.replace(old, new)

# --- compact layout: heading, map and current step fit one view ---
rep("main{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:40px 20px 72px;display:flex;flex-direction:column;gap:40px}",
    "main{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:14px 20px 56px;display:flex;flex-direction:column;gap:14px}")
rep("h1{font-family:var(--display);font-weight:700;font-size:clamp(30px,4.6vw,52px);line-height:1.05;text-wrap:balance}",
    "h1{font-family:var(--display);font-weight:700;font-size:clamp(24px,3vw,34px);line-height:1.1;text-wrap:balance}")
rep("h2{font-family:var(--display);font-weight:700;font-size:clamp(24px,3.4vw,32px);line-height:1.15;text-wrap:balance}",
    "h2{font-family:var(--display);font-weight:700;font-size:clamp(20px,2.4vw,24px);line-height:1.15;text-wrap:balance}")
rep("h3{font-family:var(--display);font-weight:500;font-size:19px;line-height:1.2}",
    "h3{font-family:var(--display);font-weight:500;font-size:17px;line-height:1.2}")
rep(".intro{display:flex;flex-direction:column;gap:14px}\n.intro p{color:var(--muted);font-size:19px;max-width:62ch}",
    ".intro{display:flex;flex-direction:column;gap:6px}\n.intro p{color:var(--muted);font-size:16px;max-width:62ch}\n.lead{display:flex;justify-content:space-between;align-items:center;gap:16px 32px;flex-wrap:wrap}")
rep(".map{position:relative;min-width:900px;height:300px}",
    ".map{position:relative;min-width:900px;height:clamp(150px,23vh,260px)}")
rep(".stop{position:absolute;transform:translate(-50%,-22px);display:flex;flex-direction:column;align-items:center;gap:8px;",
    ".stop{position:absolute;transform:translate(-50%,-18px);display:flex;flex-direction:column;align-items:center;gap:5px;")
rep(".dot{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:18px;",
    ".dot{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:16px;")
rep("width:60px;height:60px;margin:-8px 0;font-size:0}", "width:48px;height:48px;margin:-6px 0;font-size:0}")
rep(".stop .name{font-size:14px;font-weight:600;line-height:1.2;text-align:center}",
    ".stop .name{font-size:13px;font-weight:600;line-height:1.2;text-align:center}")
rep("border-radius:20px;padding:28px;display:flex;flex-direction:column;gap:24px}",
    "border-radius:20px;padding:16px 22px;display:flex;flex-direction:column;gap:12px}")
rep(".phead{display:flex;flex-direction:column;gap:6px}", ".phead{display:flex;flex-direction:column;gap:2px}")
rep(".cols{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:24px}", ".cols{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:16px}")
rep(".block{display:flex;flex-direction:column;gap:10px}", ".block{display:flex;flex-direction:column;gap:6px;font-size:15px}")
rep(".block ul{padding-left:20px;display:flex;flex-direction:column;gap:6px}", ".block ul{padding-left:20px;display:flex;flex-direction:column;gap:3px}")
rep(".gate{border-left:4px solid var(--gold);padding:10px 14px;", ".gate{border-left:4px solid var(--gold);padding:8px 12px;")
rep("border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}", "border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;font-size:15px}")
rep(".btn{font:inherit;font-weight:700;padding:10px 18px;", ".btn{font:inherit;font-weight:700;padding:8px 16px;")
rep("section{display:flex;flex-direction:column;gap:20px}", "section{display:flex;flex-direction:column;gap:12px;margin:21px 0 5px}")

# --- the two closing sections share one style ---
old_five = s[s.index(".five{"):s.index("section{display:flex")]
new_five = (
".five,ol.glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px 40px;font-size:13px;line-height:1.5;color:var(--muted)}\n"
".five div{display:block}\n"
".five h3{display:inline;font-family:var(--body);font-weight:700;font-size:inherit;line-height:inherit;color:var(--ink)}\n"
".five p{display:inline;color:inherit;font-size:inherit}\n"
"ol.glance{padding-left:24px}\n"
"ol.glance b{color:var(--ink)}\n"
".shrink h2{font-size:clamp(17px,2.4vw,22px)}\n"
)
s = s.replace(old_five, new_five)

# --- sign-in row at the bottom of the step panel (dropped from the signed-in light copy) ---
rep(".nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}",
    ".nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}\n"
    ".cta{display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--night-3);padding-top:14px}\n"
    ".cta p{color:var(--muted);font-size:15px;margin-right:6px}\n"
    "a.btn{text-decoration:none;display:inline-block}\n"
    ".btn.big{padding:11px 26px;font-size:16px}\n"
    ".btn.big.primary{box-shadow:0 0 0 4px rgba(242,88,159,.22),0 8px 24px rgba(242,88,159,.35)}")

# --- markup ---
rep('''    <p>Each star is one step. Pick a star to see what you do there, what Polaris does for you, and what opens the next step.</p>
    <div class="progress">''',
    '''    <div class="lead">
    <p>Each star is one step. Pick a star to see what you do there, what Polaris does for you, and what opens the next step.</p>
    <div class="progress">''')
rep('''<button class="btn small" id="tour" type="button">Play the tour</button></div>
  </header>''', '''<button class="btn small" id="tour" type="button">Play the tour</button></div>
    </div>
  </header>''')
rep('''      <button class="btn primary" id="next" type="button">Next step</button>
    </div>
  </article>''', '''      <button class="btn primary" id="next" type="button">Next step</button>
    </div>
    <div class="cta" id="cta">
      <p>Ready to start?</p>
      <a class="btn big primary" href="/login" target="_top">Sign in</a>
      <a class="btn big" href="/login?mode=signup" target="_top">Create account</a>
    </div>
  </article>''')
rep('  <section>\n    <h2>What makes Polaris different</h2>', '  <section class="shrink">\n    <h2>What makes Polaris different</h2>')
for t in ["A source behind every claim", "Unknown is not a low score", "Polaris recommends, you decide",
          "Research before contact spend", "Nothing is sent without approval"]:
    rep("<h3>%s</h3><p>" % t, "<h3>%s.</h3> <p>" % t)

# --- script: stars placed by percentage so the map can be shorter; height report for embedding ---
rep('b.style.top=POS[i][1]+"px";', 'b.style.top=(POS[i][1]/300*100)+"%";')
rep('''if(!matchMedia("(prefers-reduced-motion: reduce)").matches)setTimeout(play,1200);
</script>''', '''if(!matchMedia("(prefers-reduced-motion: reduce)").matches)setTimeout(play,1200);

/* When embedded in the app, report the page height so the iframe can fit it. */
(function(){
  if(window.parent===window)return;
  document.body.classList.add("embedded");
  function report(){window.parent.postMessage({type:"polaris-how-it-works-height",height:document.documentElement.scrollHeight},location.origin)}
  if("ResizeObserver" in window)new ResizeObserver(report).observe(document.body);
  addEventListener("load",report);report();
})();
</script>''')

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("relayout done", len(s))
