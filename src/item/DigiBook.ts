import { promisePool } from '@/util/promise';
import { Book } from './Book';

export class DigiBook extends Book {
  async download(outDir: string, concurrency = 10, mergePdfs = true) {
    const dir = await this.mkSubDir(outDir);

    // Get url of 1st svg page
    const checkPage = await this.shelf.browser.newPage();
    let page1Url: string;
    try {
      await checkPage.goto(new URL(`?page=1`, this.url).toString(), {
        waitUntil: 'networkidle2',
      });
      page1Url = await checkPage.$eval(
        '#pg1 > object',
        (obj) => (obj as HTMLObjectElement).data
      );
    } finally {
      await checkPage.close();
    }

    // Page download pool
    let pageCount = 0;

    await promisePool(async (i, stop) => {
      const pageNo = i + 1;

      const page = await this.shelf.browser.newPage();
      try {
        // Go to current svg page
        const res = await page.goto(
          new URL(
            page1Url.replace(/(?<=\/)1(?=\.|$)/g, pageNo.toString()),
            this.url
          ).toString(),
          {
            waitUntil: 'networkidle2',
          }
        );
        if (!res.ok()) return stop();

        // Save it as pdf
        const pdfFile = this.getPdfPath(dir, ++pageCount);

        await page.pdf({
          format: 'a4',
          path: pdfFile,
        });
      } finally {
        await page.close();
      }
    }, concurrency);

    // Merge pdf pages
    mergePdfs && (await this.mergePdfPages(dir, pageCount));
  }
}
