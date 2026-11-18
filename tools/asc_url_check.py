import os, time, jwt, requests, json
key=os.environ["ASC_KEY_P8"]; kid=os.environ["ASC_KEY_ID"]; iss=os.environ["ASC_ISSUER_ID"]
tok=jwt.encode({"iss":iss,"iat":int(time.time()),"exp":int(time.time())+1100,"aud":"appstoreconnect-v1"},key,algorithm="ES256",headers={"kid":kid})
H={"Authorization":"Bearer "+tok}
B="https://api.appstoreconnect.apple.com/v1/"
def g(p): r=requests.get(B+p,headers=H); r.raise_for_status(); return r.json()
print("== live app-ads.txt ==")
r=requests.get("https://halfgridgames-ai.github.io/app-ads.txt"); print(r.status_code, r.headers.get("content-type"), repr(r.text))
for app in ["6829033479","6829033430","6829033071"]:
    print("\n==== app",app)
    lk=requests.get(f"https://itunes.apple.com/lookup?id={app}").json()
    for x in lk.get("results",[]): print("public lookup:",x.get("trackName"),"| sellerUrl:",x.get("sellerUrl"),"| version:",x.get("version"))
    vs=g(f"apps/{app}/appStoreVersions?limit=10")["data"]
    for v in vs:
        a=v["attributes"]; print("version",a["versionString"],a["appStoreState"],v["id"])
        for l in g(f"appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]:
            la=l["attributes"]; print("   ",la["locale"],"marketing:",la.get("marketingUrl"),"| support:",la.get("supportUrl"),"| loc",l["id"])
