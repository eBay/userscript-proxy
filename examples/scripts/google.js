// This example modifies Google search result pages and adds a link to an eBay search as the top result
(function() {
  console.log('Userscript proxy activated - Alter Google results');
  var search = undefined;
  var query;
  var queryComponent;
  var queryDecoded;
  window.setInterval(function() {
    if (document.body.classList.contains('srp') != -1) {

      query = window.location.href.match(/[?&#]q=([^&]*)/);
      queryComponent = query[1];

      //Google could always change their website styling, so this may only work for this snapshot in time
      //Still, this example should give you an idea about how to add elements to a page, based on a query
      if (search != queryComponent && document.getElementById('center_col')) {
        queryDecoded = decodeURIComponent(query[1].replace(/\+/g, ' '));
        search = queryComponent;

        var div = document.createElement('div');
        div.setAttribute("id", "ebay-add-search-result");
        div.setAttribute("class", "mnr-c");
        
        var url = "http://www.ebay.com/sch/i.html?_nkw="+queryComponent;
        var output;

        //Use different styling based on Google's mobile/desktop breakpoint
        if (document.getElementById('rcnt')) { //Desktop
          output = `
<div id="res">
  <div class="g">
    <div class="rc">
      <h3 class="r"><a href="`+url+`">`+queryDecoded+` | eBay</a></h3>
      <div class="s">
        <div>
          <div class="f kv _SWb" style="white-space:nowrap"><cite class="_Rm">eBay › ... › `+queryDecoded+`</cite></div>
          <span class="st">Buy `+queryDecoded+` on eBay</span>
        </div>
      </div>
    </div>
  </div>
</div>`;
        } else { //Mobile
          output = `
<div class="mnr-c">
  <div class="g card-section">
    <div class="rc">
      <div class="_OXf">
        <div class="_fSg"><h3 class="r"><a class="_wSg" href="`+url+`">`+queryDecoded+` | eBay</a></h3></div>
        <div class="f kv _SWb _fof"><cite class="_Rm bc">eBay › ... › `+queryDecoded+`</cite></div>
      </div>
      <div class="s">
        <div><span class="st"><span class="f"></span>Buy `+queryDecoded+` on eBay</span></div>
      </div>
    </div>
  </div>
</div>`;
        }

        div.innerHTML = output;
        if (document.getElementById("ebay-add-search-result")) {
          element = document.getElementById("ebay-add-search-result");
          element.parentNode.removeChild(element);
        }
        document.getElementById('center_col').insertBefore(div, document.getElementById('center_col').firstChild);
      }
    }
  }, 100);
})();
