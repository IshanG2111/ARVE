# Vulnerable: Command Injection
import os

def ping_host(request):
    ip = request.args.get("ip")
    os.system("ping -c 1 " + ip)
