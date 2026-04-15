#!/usr/bin/env python3
"""
生成 Chrome 扩展图标
使用 Pillow 创建简单的图标
"""

from PIL import Image, ImageDraw
import os

def create_icon(size, output_path):
    """创建指定尺寸的图标"""
    # 创建透明背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆角矩形背景
    radius = size // 5
    bg_color = (66, 133, 244, 255)  # Google Blue
    
    # 绘制圆角矩形
    draw.rounded_rectangle(
        [(0, 0), (size, size)],
        radius=radius,
        fill=bg_color
    )
    
    # 计算内部矩形（图片框架）
    padding = size // 6
    inner_size = size - 2 * padding
    inner_radius = size // 20
    
    # 绘制白色图片框架
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=inner_radius,
        fill=(255, 255, 255, 255),
        outline=(52, 168, 83, 255),  # Google Green
        width=max(1, size // 32)
    )
    
    # 绘制简单的风景图案
    if size >= 48:
        # 太阳
        sun_x = size - padding - inner_size // 4
        sun_y = padding + inner_size // 4
        sun_radius = inner_size // 8
        draw.ellipse(
            [(sun_x - sun_radius, sun_y - sun_radius),
             (sun_x + sun_radius, sun_y + sun_radius)],
            fill=(251, 188, 4, 255)  # Google Yellow
        )
        
        # 山脉
        mountain_color = (52, 168, 83, 255)  # Google Green
        points = [
            (padding, size - padding),
            (padding + inner_size // 3, padding + inner_size // 3),
            (padding + inner_size // 2, padding + inner_size // 2),
            (padding + inner_size // 1.5, padding + inner_size // 4),
            (size - padding, size - padding)
        ]
        draw.polygon(points, fill=mountain_color)
    
    # 绘制下载箭头
    arrow_color = (255, 255, 255, 255)
    arrow_size = size // 6
    center_x = size // 2
    arrow_y = size - padding - inner_size // 4
    
    # 箭头杆
    arrow_width = size // 12
    draw.rectangle(
        [(center_x - arrow_width // 2, arrow_y - arrow_size // 2),
         (center_x + arrow_width // 2, arrow_y + arrow_size // 4)],
        fill=arrow_color
    )
    
    # 箭头尖
    arrow_head_size = size // 10
    draw.polygon([
        (center_x, arrow_y + arrow_size // 4),
        (center_x - arrow_head_size // 2, arrow_y - arrow_size // 4),
        (center_x + arrow_head_size // 2, arrow_y - arrow_size // 4)
    ], fill=arrow_color)
    
    # 保存图标
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")

def main():
    """主函数"""
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 生成三种尺寸的图标
    create_icon(16, os.path.join(icons_dir, 'icon16.png'))
    create_icon(48, os.path.join(icons_dir, 'icon48.png'))
    create_icon(128, os.path.join(icons_dir, 'icon128.png'))
    
    print("\nAll icons created successfully!")

if __name__ == '__main__':
    main()