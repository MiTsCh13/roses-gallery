export function testDatabaseUrl(): string {
  return (
    process.env.TEST_DATABASE_URL ??
    "postgres://roses:roses@localhost:5432/roses_gallery_test"
  );
}
