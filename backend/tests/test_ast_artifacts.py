from io import BytesIO

from app.scanner.artifacts import ScanArtifactStore


class FakeB2Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, **kwargs):
        self.objects[(kwargs["Bucket"], kwargs["Key"])] = {
            "Body": kwargs["Body"], "Metadata": kwargs["Metadata"],
        }

    def get_object(self, **kwargs):
        item = self.objects[(kwargs["Bucket"], kwargs["Key"])]
        return {"Body": BytesIO(item["Body"]), "Metadata": item["Metadata"]}


def test_ast_json_artifact_round_trip_and_checksum():
    store = ScanArtifactStore(client=FakeB2Client())
    store.bucket = "arve-test"
    store.prefix = "scans"
    document = {"schema_version": "1.0.0", "files": [], "relationships": []}
    stored = store.persist_json_document("scan-123", "ast", "ast-output.json", document)
    loaded, checksum = store.read_json_document(stored["key"])
    assert stored["status"] == "STORED"
    assert stored["key"] == "scans/scan-123/ast/ast-output.json"
    assert loaded == document
    assert checksum == stored["sha256"]


def test_ast_json_artifacts_are_separated_by_scan():
    store = ScanArtifactStore(client=FakeB2Client())
    store.bucket = "arve-test"
    store.prefix = "scans"
    first = store.persist_json_document("scan-a", "ast", "ast-output.json", {"files": []})
    second = store.persist_json_document("scan-b", "ast", "ast-output.json", {"files": []})
    assert first["key"] != second["key"]
    assert first["key"].startswith("scans/scan-a/")
    assert second["key"].startswith("scans/scan-b/")
