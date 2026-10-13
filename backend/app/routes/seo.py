from datetime import datetime, timezone
from fastapi import APIRouter, Response
from app.config import settings
from app.database import get_database

router = APIRouter(tags=["SEO"])

@router.get("/sitemap.xsl", response_class=Response)
async def get_sitemap_xsl():
    """
    XSL stylesheet to render sitemap.xml with modern, elegant visual styling in browsers.
    Eliminates browser warning: 'This XML file does not appear to have any style information'
    """
    xsl_content = """<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
    xmlns:html="http://www.w3.org/TR/REC-html40"
    xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap — NextGen PG Booking</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 1040px;
            margin: 0 auto;
          }
          .header {
            background: #111827;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px 30px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            color: #ffffff;
          }
          p {
            margin: 0;
            color: #9ca3af;
            font-size: 14px;
            line-height: 1.5;
          }
          .stats {
            display: inline-block;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 20px;
            padding: 4px 14px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #111827;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          }
          th {
            background-color: #1f2937;
            color: #9ca3af;
            text-align: left;
            padding: 14px 18px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          td {
            padding: 14px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 14px;
          }
          tr:hover td {
            background-color: rgba(255, 255, 255, 0.02);
          }
          a {
            color: #60a5fa;
            text-decoration: none;
            word-break: break-all;
          }
          a:hover {
            text-decoration: underline;
          }
          .priority {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
          }
          .p-high { background: rgba(16, 185, 129, 0.15); color: #34d399; }
          .p-med { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>XML Sitemap — NextGen PG Booking</h1>
            <p>Generated dynamically for Google Search Console &amp; search crawlers. Covers student and executive residences across Jaipur, Neemrana, Behror, and Kotputli.</p>
            <div class="stats">
              Total Indexed URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 55%;">URL</th>
                <th style="width: 15%;">Priority</th>
                <th style="width: 15%;">Change Frequency</th>
                <th style="width: 15%;">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td>
                    <a>
                      <xsl:attribute name="href">
                        <xsl:value-of select="sitemap:loc"/>
                      </xsl:attribute>
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td>
                    <span class="priority p-high">
                      <xsl:value-of select="sitemap:priority"/>
                    </span>
                  </td>
                  <td>
                    <xsl:value-of select="sitemap:changefreq"/>
                  </td>
                  <td>
                    <xsl:value-of select="sitemap:lastmod"/>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
"""
    return Response(content=xsl_content, media_type="text/xsl")


@router.get("/sitemap.xml", response_class=Response)
async def get_sitemap():
    """
    Dynamically generates sitemap.xml for Google Search Console
    per p.md line 36.
    Includes XSL stylesheet link for elegant browser rendering.
    """
    db = get_database()
    properties = await db["properties"].find({}).to_list(1000)

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base_url = settings.FRONTEND_URL.rstrip("/")

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml-stylesheet type="text/xsl" href="/api/sitemap.xsl"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        f'    <loc>{base_url}/</loc>',
        f'    <lastmod>{now_iso}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
    ]

    # Core target cities from p.md: jaipur, neemrana, behror, kotputli
    cities = ["jaipur", "neemrana", "behror", "kotputli"]
    for c in cities:
        xml_lines.extend([
            '  <url>',
            f'    <loc>{base_url}/cities/{c}</loc>',
            f'    <lastmod>{now_iso}</lastmod>',
            '    <changefreq>daily</changefreq>',
            '    <priority>0.9</priority>',
            '  </url>',
        ])

    # Dynamic property pages
    for p in properties:
        prop_id = p["_id"]
        created = p.get("created_at", now_iso)[:10]
        xml_lines.extend([
            '  <url>',
            f'    <loc>{base_url}/properties/{prop_id}</loc>',
            f'    <lastmod>{created}</lastmod>',
            '    <changefreq>weekly</changefreq>',
            '    <priority>0.8</priority>',
            '  </url>',
        ])

    xml_lines.append('</urlset>')
    xml_content = "\n".join(xml_lines)

    return Response(content=xml_content, media_type="application/xml")


@router.get("/robots.txt", response_class=Response)
async def get_robots_txt():
    """Returns robots.txt guiding search engines to the sitemap."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    content = f"""User-agent: *
Allow: /
Allow: /cities/
Allow: /properties/
Disallow: /admin/
Disallow: /dashboard/

Sitemap: {base_url}/api/sitemap.xml
"""
    return Response(content=content, media_type="text/plain")
