FROM python:3.12-alpine

RUN addgroup -S arve && adduser -S -G arve -u 1000 arve
COPY scanner.py /usr/local/bin/arve-phase3-test-scanner
RUN chmod 755 /usr/local/bin/arve-phase3-test-scanner && chown arve:arve /usr/local/bin/arve-phase3-test-scanner
USER arve:arve
WORKDIR /code
ENTRYPOINT ["/usr/local/bin/arve-phase3-test-scanner"]
