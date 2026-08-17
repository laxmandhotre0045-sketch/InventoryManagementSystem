import json
import urllib.request
import urllib.error

url = 'http://127.0.0.1:8091/api/v1/auth/login'
data = json.dumps({'email': 'masteradmin@sensovibe.in', 'password': 'sensovibe@555'}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    print(resp.status)
    print(resp.read().decode())
except urllib.error.HTTPError as e:
    print('STATUS', e.code)
    print(e.read().decode())
except Exception as ex:
    print('ERROR', ex)
