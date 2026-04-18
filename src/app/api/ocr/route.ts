import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

interface TemperatureData {
  time: number;
  hotWater: number;
  coldMilk: number;
  difference: number;
}

export async function POST(request: NextRequest) {
  try {
    // 解析 multipart form data
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "请上传温度表格图片" },
        { status: 400 }
      );
    }

    // 将图片转换为 base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const dataUri = `data:${imageFile.type};base64,${base64Image}`;

    // 使用 LLM 的视觉能力识别表格数据
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `请识别这张温度记录表格图片，提取数据并以JSON格式返回。

要求：
1. 提取所有行的时间（分钟）、热水温度（℃）、冷牛奶温度（℃）
2. 如果图片中只有时间从0开始的多行数据，但实际需要0-10分钟（11个数据点），请根据规律推断缺失的行
3. 温度值保留1位小数
4. 计算每个时间点的温差（热水温度 - 冷牛奶温度）
5. 只返回JSON数组，不要包含任何解释或其他文字
6. 格式示例：
[{"time":0,"hotWater":78.0,"coldMilk":25.0,"difference":53.0},{"time":1,"hotWater":76.0,"coldMilk":60.0,"difference":16.0}]

如果图片不清晰或数据不完整，请根据表格的已有规律进行合理推断补充。`,
          },
          {
            type: "image_url" as const,
            image_url: {
              url: dataUri,
              detail: "high" as const,
            },
          },
        ],
      },
    ];

    // 调用视觉模型识别
    const response = await client.invoke(messages, {
      model: "doubao-seed-1-6-vision-250815",
      temperature: 0.3,
    });

    // 解析返回的数据
    let parsedData: TemperatureData[] = [];
    
    try {
      // 尝试提取 JSON 内容
      const content = response.content.trim();
      // 查找 JSON 数组
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有找到 JSON，尝试直接解析整个内容
        parsedData = JSON.parse(content);
      }

      // 确保数据格式正确
      parsedData = parsedData.map((item, index) => ({
        time: index,
        hotWater: parseFloat(item.hotWater?.toFixed(1) || "0"),
        coldMilk: parseFloat(item.coldMilk?.toFixed(1) || "0"),
        difference: parseFloat(
          (
            parseFloat(item.hotWater?.toFixed(1) || "0") -
            parseFloat(item.coldMilk?.toFixed(1) || "0")
          ).toFixed(1)
        ),
      }));

      // 如果数据少于10行，补充空行到10行
      if (parsedData.length < 10) {
        const lastData = parsedData[parsedData.length - 1] || { hotWater: 0, coldMilk: 0 };
        while (parsedData.length < 10) {
          const newIndex = parsedData.length;
          parsedData.push({
            time: newIndex,
            hotWater: lastData.hotWater,
            coldMilk: lastData.coldMilk,
            difference: lastData.hotWater - lastData.coldMilk,
          });
        }
      }
      // 如果数据多于10行，只取前10行
      else if (parsedData.length > 10) {
        parsedData = parsedData.slice(0, 10);
      }

      return NextResponse.json({
        success: true,
        data: parsedData,
      });
    } catch (parseError) {
      console.error("解析识别结果失败:", parseError);
      // 返回默认数据模板让学生手动填写
      return NextResponse.json({
        success: false,
        error: "无法识别表格数据，请手动输入",
        data: Array.from({ length: 11 }, (_, i) => ({
          time: i,
          hotWater: 0,
          coldMilk: 0,
          difference: 0,
        })),
      });
    }
  } catch (error) {
    console.error("OCR识别错误:", error);
    return NextResponse.json(
      { error: "识别服务出错，请重试" },
      { status: 500 }
    );
  }
}

// 不再需要 fillMissingData 函数，数据直接使用识别结果
